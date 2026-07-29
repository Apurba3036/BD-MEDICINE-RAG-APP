import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Map as MapLibre, Marker, Popup, NavigationControl } from 'maplibre-gl'; // ✅ named imports for v6
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from './ThemeContext';
import {
  Search, MapPin, Building2,
  Sun, Moon, Maximize2, Phone, ChevronLeft, ChevronRight
} from 'lucide-react';

import DISTRICT_GEOJSON_DATA from '../public/data/bd_adm2.json';
import SHELTER_INITIAL_DATA from '../public/data/shelter.json';

const BANGLADESH_CENTER = [89.9121, 23.9664];

const SHELTER_COLOR = {
  Cyclone: '#ef4444',
  Flood:   '#0ea5e9',
  default: '#f97316', // Mujib Killa / Disaster
};

function shelterColor(type) {
  return SHELTER_COLOR[type] ?? SHELTER_COLOR.default;
}

/* ─────────────────────────────────────────────────────────────────────────── */

export default function DistrictMap() {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const markersRef      = useRef([]);      // active Marker instances
  const popupRef        = useRef(null);    // single shared popup
  const [mapReady, setMapReady] = useState(false);

  const { theme, toggleTheme } = useTheme();

  const [shelterData]     = useState(SHELTER_INITIAL_DATA);
  const [selectedType,  setSelectedType]  = useState('ALL');
  const [searchQuery,   setSearchQuery]   = useState('');
  const [selectedShelter, setSelectedShelter] = useState(null);
  const [currentPage,   setCurrentPage]   = useState(1);
  const [pageSize,      setPageSize]      = useState(10);

  /* ── Filtered list (for table) ─────────────────────────────────────────── */
  const filteredShelters = useMemo(() => {
    let list = shelterData ?? [];
    if (selectedType !== 'ALL') {
      if (selectedType === 'Disaster') {
        list = list.filter(s => s.shelter_type_id !== 'Cyclone' && s.shelter_type_id !== 'Flood');
      } else {
        list = list.filter(s => s.shelter_type_id === selectedType);
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        [s.name, s.district_name, s.upazila_name, s.contact_person, s.constructed_by]
          .some(v => v && v.toLowerCase().includes(q))
      );
    }
    return list;
  }, [shelterData, selectedType, searchQuery]);

  const totalPages      = Math.max(1, Math.ceil(filteredShelters.length / pageSize));
  const paginatedList   = useMemo(() => {
    const s = (currentPage - 1) * pageSize;
    return filteredShelters.slice(s, s + pageSize);
  }, [filteredShelters, currentPage, pageSize]);

  /* ── MapLibre tile style ────────────────────────────────────────────────── */
  function buildStyle(t) {
    const url = t === 'dark'
      ? 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'
      : 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png';
    return {
      version: 8,
      sources: { cartodb: { type: 'raster', tiles: [url], tileSize: 256, attribution: '© CARTO | DDM' } },
      layers:  [{ id: 'cartodb-layer', type: 'raster', source: 'cartodb' }],
    };
  }

  /* ── District boundary layers ───────────────────────────────────────────── */
  function addDistrictLayers(map) {
    if (map.getSource('districts')) return;
    map.addSource('districts', { type: 'geojson', data: DISTRICT_GEOJSON_DATA });
    map.addLayer({ id: 'district-fill', type: 'fill',   source: 'districts',
      paint: { 'fill-color': '#94a3b8', 'fill-opacity': 0.10 } });
    map.addLayer({ id: 'district-line', type: 'line',   source: 'districts',
      paint: { 'line-color': '#64748b', 'line-width': 0.8 } });
  }

  /* ── Clear all Marker instances ─────────────────────────────────────────── */
  function clearMarkers() {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
  }

  /* ── Render MapLibre Marker API instances ───────────────────────────────── */
  const renderMarkers = useCallback((shelters) => {
    const map = mapRef.current;
    if (!map) return;

    clearMarkers();

    const valid = shelters.filter(item => {
      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      return !isNaN(lat) && !isNaN(lon) && lat > 15 && lat < 30 && lon > 80 && lon < 95;
    });

    valid.forEach(item => {
      const lat   = parseFloat(item.lat);
      const lon   = parseFloat(item.lon);
      const color = shelterColor(item.shelter_type_id);

      /* Custom circular element wrapper so MapLibre transform is not overridden */
      const el = document.createElement('div');
      el.style.cursor = 'pointer';

      const dot = document.createElement('div');
      dot.style.cssText = [
        'width:12px', 'height:12px', 'border-radius:50%',
        `background:${color}`, 'border:2px solid #fff',
        'box-shadow:0 1px 4px rgba(0,0,0,0.45)',
        'transition:transform 0.15s ease',
      ].join(';');
      el.appendChild(dot);

      /* Popup HTML */
      const popupHTML = `
        <div style="font-family:system-ui,sans-serif;padding:6px 2px;min-width:220px">
          <div style="font-weight:700;font-size:13px;color:#1e293b;
               border-bottom:1px solid #e2e8f0;padding-bottom:5px;margin-bottom:8px">
            ${item.name || 'Shelter'}
          </div>
          <div style="font-size:11px;color:#475569;line-height:1.9">
            <div><b>Type:</b>&nbsp;
              <span style="background:${color};color:#fff;
                padding:1px 7px;border-radius:3px;font-size:10px;font-weight:700">
                ${item.shelter_type_id || 'Disaster'}
              </span>
            </div>
            <div><b>Location:</b> ${[item.union_name,item.upazila_name,item.district_name].filter(Boolean).join(', ')}</div>
            <div><b>Capacity:</b> ${item.capacity ?? 'N/A'} persons</div>
            <div><b>Covering:</b> ${item.covering_people ?? 'N/A'}</div>
            <div><b>Built by:</b> ${item.constructed_by ?? 'N/A'} (${item.construction_year ?? 'N/A'})</div>
            <div><b>Contact:</b> ${item.contact_person ?? 'N/A'} — <a href="tel:${item.contact_no}" style="color:#4f46e5;font-weight:700">${item.contact_no ?? 'N/A'}</a></div>
          </div>
        </div>`;

      const popup = new Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 14,
        maxWidth: '290px',
      })
        .setLngLat([lon, lat])
        .setHTML(popupHTML);

      /* ✅ MapLibre Marker API  */
      const marker = new Marker({ element: el })
        .setLngLat([lon, lat])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener('mouseenter', () => {
        dot.style.transform = 'scale(1.8)';
        if (!popup.isOpen()) {
          popup.addTo(map);
        }
      });

      el.addEventListener('mouseleave', () => {
        dot.style.transform = 'scale(1)';
        popup.remove();
      });

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedShelter(item);
        if (!popup.isOpen()) {
          popup.addTo(map);
        }
      });

      markersRef.current.push(marker);
    });
  }, []);

  /* ── Initialize map once ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new MapLibre({
      container: mapContainerRef.current,
      style: buildStyle(theme),
      center: BANGLADESH_CENTER,
      zoom: 6.8,
      maxBounds: [[85.0, 19.5], [95.0, 28.0]],
    });

    map.addControl(new NavigationControl({ showCompass: true }), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      addDistrictLayers(map);
      setMapReady(true); // triggers the marker effect
    });

    return () => {
      clearMarkers();
      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Re-render markers whenever filter/search changes (after map ready) ── */
  useEffect(() => {
    if (!mapReady) return;
    renderMarkers(filteredShelters);
  }, [mapReady, filteredShelters, renderMarkers]);

  /* ── Fly to shelter from table ──────────────────────────────────────────── */
  function flyToShelter(item) {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    if (!isNaN(lat) && !isNaN(lon) && mapRef.current) {
      setSelectedShelter(item);
      mapRef.current.flyTo({ center: [lon, lat], zoom: 13, duration: 1400 });
      // Open the marker popup
      const found = markersRef.current.find(m => {
        const ll = m.getLngLat();
        return Math.abs(ll.lat - lat) < 0.0001 && Math.abs(ll.lng - lon) < 0.0001;
      });
      if (found) {
        if (!found.getPopup().isOpen()) {
          found.togglePopup();
        }
      }
    }
  }

  function resetView() {
    mapRef.current?.flyTo({ center: BANGLADESH_CENTER, zoom: 6.8, duration: 1200 });
    setSelectedType('ALL'); setSearchQuery(''); setSelectedShelter(null); setCurrentPage(1);
  }

  /* ── Shelter type stats ─────────────────────────────────────────────────── */
  const stats = useMemo(() => ({
    total:   shelterData.length,
    cyclone: shelterData.filter(s => s.shelter_type_id === 'Cyclone').length,
    flood:   shelterData.filter(s => s.shelter_type_id === 'Flood').length,
    disaster:shelterData.filter(s => s.shelter_type_id !== 'Cyclone' && s.shelter_type_id !== 'Flood').length,
  }), [shelterData]);

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="w-full h-full flex flex-col bg-slate-100 dark:bg-slate-900 overflow-y-auto font-sans text-slate-800 dark:text-slate-100">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-6 py-4 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-xl shadow border border-red-300 dark:border-red-700 shrink-0 text-white">🇧🇩</div>
            <div>
              <h1 className="font-extrabold text-lg sm:text-xl tracking-tight flex items-center gap-2">
                AWARE <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-700">DDM MoDMR</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Advanced Warning &amp; Analytics for Risk &amp; Emergencies · Department of Disaster Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold">Shelter Map</span>
            <button onClick={toggleTheme} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 transition-colors" title="Toggle theme">
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">

        {/* ── Stat cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Shelters',   value: stats.total,    color: 'indigo', dot: '#6366f1' },
            { label: 'Cyclone Shelters', value: stats.cyclone,  color: 'red',    dot: '#ef4444' },
            { label: 'Flood Shelters',   value: stats.flood,    color: 'sky',    dot: '#0ea5e9' },
            { label: 'Mujib Killa',      value: stats.disaster, color: 'amber',  dot: '#f97316' },
          ].map(({ label, value, color, dot }) => (
            <div key={label} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow border border-slate-200 dark:border-slate-700 flex items-center gap-3">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: dot }} />
              <div>
                <div className="text-xl font-extrabold text-slate-900 dark:text-white">{value.toLocaleString()}</div>
                <div className="text-[11px] text-slate-500 font-medium">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Map card ─────────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">

          {/* Filter / legend bar */}
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MapPin className="text-red-500" size={20} />
                Shelter Interactive Map
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Showing <b>{filteredShelters.length}</b> of <b>{stats.total}</b> emergency shelters
              </p>
            </div>

            {/* Legend + filters */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              {[
                { key: 'ALL',     label: `All (${stats.total})`,         bg: 'slate',  dot: null },
                { key: 'Cyclone', label: `Cyclone (${stats.cyclone})`,   bg: 'red',    dot: '#ef4444' },
                { key: 'Flood',   label: `Flood (${stats.flood})`,       bg: 'sky',    dot: '#0ea5e9' },
                { key: 'Disaster',label: `Mujib Killa (${stats.disaster})`, bg: 'amber', dot: '#f97316' },
              ].map(({ key, label, bg, dot }) => {
                const active = selectedType === key;
                const activeClass = {
                  slate: 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900',
                  red:   'bg-red-600   text-white border-red-600',
                  sky:   'bg-sky-600   text-white border-sky-600',
                  amber: 'bg-amber-600 text-white border-amber-600',
                }[bg];
                const idleClass = {
                  slate: 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-100',
                  red:   'bg-red-50   dark:bg-red-950/30   text-red-700   dark:text-red-300   border-red-200   dark:border-red-800   hover:bg-red-100',
                  sky:   'bg-sky-50   dark:bg-sky-950/30   text-sky-700   dark:text-sky-300   border-sky-200   dark:border-sky-800   hover:bg-sky-100',
                  amber: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100',
                }[bg];
                return (
                  <button key={key}
                    onClick={() => { setSelectedType(key); setCurrentPage(1); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${active ? activeClass : idleClass}`}
                  >
                    {dot && <span className="w-2.5 h-2.5 rounded-full" style={{ background: dot }} />}
                    {label}
                  </button>
                );
              })}
              <button onClick={resetView} title="Reset map" className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200">
                <Maximize2 size={14} />
              </button>
            </div>
          </div>

          {/* Map container */}
          <div className="relative w-full" style={{ height: '520px' }}>
            <div ref={mapContainerRef} className="w-full h-full" />

            {/* Inline legend overlay */}
            <div className="absolute bottom-4 left-4 z-10 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-xl px-4 py-3 shadow-lg border border-slate-200 dark:border-slate-700 text-xs">
              <p className="font-bold text-slate-700 dark:text-slate-200 mb-2 text-[11px] uppercase tracking-wider">Legend</p>
              {[
                { color: '#ef4444', label: 'Cyclone Shelter' },
                { color: '#0ea5e9', label: 'Flood Shelter' },
                { color: '#f97316', label: 'Mujib Killa / Disaster' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full border-2 border-white shadow" style={{ background: color }} />
                  <span className="text-slate-600 dark:text-slate-300">{label}</span>
                </div>
              ))}
            </div>

            {/* Selected shelter info panel */}
            {selectedShelter && (
              <div className="absolute top-4 left-4 z-20 w-72 bg-white/96 dark:bg-slate-800/96 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-fade-in">
                <div className="flex items-start justify-between mb-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold text-white mb-1"
                      style={{ background: shelterColor(selectedShelter.shelter_type_id) }}>
                      {selectedShelter.shelter_type_id} Shelter
                    </span>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">{selectedShelter.name}</h4>
                  </div>
                  <button onClick={() => setSelectedShelter(null)} className="text-slate-400 hover:text-slate-600 p-1 text-xs">✕</button>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                  <div><b>Location:</b> {[selectedShelter.union_name, selectedShelter.upazila_name, selectedShelter.district_name].filter(Boolean).join(', ')}</div>
                  <div><b>Capacity:</b> {selectedShelter.capacity ?? 'N/A'} persons</div>
                  <div><b>Covering:</b> {selectedShelter.covering_people ?? 'N/A'}</div>
                  <div><b>Built by:</b> {selectedShelter.constructed_by ?? 'N/A'}</div>
                  <div><b>Contact:</b> {selectedShelter.contact_person ?? 'N/A'}</div>
                  <div><b>Phone:</b> <a href={`tel:${selectedShelter.contact_no}`} className="text-indigo-600 font-bold underline">{selectedShelter.contact_no ?? 'N/A'}</a></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Shelter table ────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="text-indigo-600" size={20} /> Shelter Directory
            </h3>
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
                Show
                <select value={pageSize} onChange={e => { setPageSize(+e.target.value); setCurrentPage(1); }}
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold">
                  {[10,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                entries
              </div>
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input type="text" value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  placeholder="Search shelter, district…"
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <th className="py-3 px-4 text-center w-10">#</th>
                  <th className="py-3 px-4 min-w-[200px]">Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Area (sq ft)</th>
                  <th className="py-3 px-4">Constructed By</th>
                  <th className="py-3 px-4">Year</th>
                  <th className="py-3 px-4">Covering</th>
                  <th className="py-3 px-4 min-w-[170px]">Location</th>
                  <th className="py-3 px-4 min-w-[140px]">Contact</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {paginatedList.length > 0 ? paginatedList.map((item, idx) => {
                  const gi = (currentPage - 1) * pageSize + idx + 1;
                  const color = shelterColor(item.shelter_type_id);
                  return (
                    <tr key={idx} className="hover:bg-indigo-50/40 dark:hover:bg-slate-700/30 transition-colors text-slate-700 dark:text-slate-200">
                      <td className="py-2.5 px-4 font-mono text-center text-slate-400 font-bold">{gi}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                          {item.name}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: color }}>
                          {item.shelter_type_id ?? 'Disaster'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono">{item.area ?? 'N/A'}</td>
                      <td className="py-2.5 px-4">{item.constructed_by ?? 'N/A'}</td>
                      <td className="py-2.5 px-4 font-mono">{item.construction_year ?? 'N/A'}</td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-indigo-600 dark:text-indigo-400">{item.covering_people ?? item.capacity ?? 'N/A'}</td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                        {item.union_name ? `${item.union_name}, ` : ''}{item.upazila_name}, <b>{item.district_name}</b>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold">{item.contact_person ?? 'N/A'}</div>
                        <div className="text-[10px] font-mono text-slate-500">{item.contact_no ?? ''}</div>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {item.status ?? 'Usable'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button onClick={() => flyToShelter(item)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition-colors shadow-sm">
                          Locate
                        </button>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-slate-400 text-sm">
                      No shelters match the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-500">
              Showing <b>{Math.min((currentPage-1)*pageSize+1, filteredShelters.length)}</b>–<b>{Math.min(currentPage*pageSize, filteredShelters.length)}</b> of <b>{filteredShelters.length}</b>
            </span>
            <div className="flex items-center gap-1.5 font-bold">
              <button onClick={() => setCurrentPage(p => Math.max(p-1,1))} disabled={currentPage===1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-100 disabled:opacity-40">
                <ChevronLeft size={14} />
              </button>
              <span className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white">{currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(p+1,totalPages))} disabled={currentPage===totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-100 disabled:opacity-40">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Emergency hotline ─────────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white rounded-2xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-4 border border-red-500">
          <div className="flex items-center gap-3">
            <Phone size={26} className="animate-bounce shrink-0" />
            <div>
              <h3 className="font-extrabold text-base sm:text-lg">24/7 Disaster Emergency Hotline</h3>
              <p className="text-xs text-red-100">Contact Department of Disaster Management for immediate shelter assistance during hazards.</p>
            </div>
          </div>
          <a href="tel:1090" className="px-6 py-2.5 rounded-xl bg-white text-red-700 font-extrabold text-sm shadow-md hover:bg-red-50 transition-colors">
            Call 1090
          </a>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <footer className="bg-slate-900 text-slate-300 rounded-2xl p-6 sm:p-8 space-y-6 text-xs border border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pb-6 border-b border-slate-800">
            {[
              { title: 'Emergency Services', items: ['National Emergency: 999', 'Disaster Helpline: 1090', 'Fire Services: 16163', 'Medical Emergency: 16263'] },
              { title: 'Quick Links',        items: ['Cyclone Warnings', 'Flood Forecasting (FFWC)', 'Flash Flood Alerts', 'Weather Bulletins'] },
              { title: 'Resources',          items: ['Shelter Directory', 'Disaster Management Act', 'SOD Guidelines', 'Risk Assessment Reports'] },
              { title: 'Department Info',    items: ['Department of Disaster Management (DDM)', 'Disaster Management Building', '92-93 Mohakhali C/A, Dhaka 1212'] },
            ].map(({ title, items }) => (
              <div key={title}>
                <h4 className="font-bold text-white mb-2 text-sm">{title}</h4>
                <ul className="space-y-1 text-slate-400">{items.map(i => <li key={i}>{i}</li>)}</ul>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 text-slate-400">
            <p>© DDM MoDMR – AWARE Risk &amp; Emergency Analytics System. All Rights Reserved.</p>
            <p className="font-mono">BD-Medicine AI GIS Integration</p>
          </div>
        </footer>

      </div>
    </div>
  );
}
