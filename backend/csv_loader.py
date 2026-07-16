# import pandas as pd
# import os

# def load_medicines():
#     # Adjusted path to go one directory up since data is in archive folder
#     csv_path = os.path.join(os.path.dirname(__file__), "..", "medicine.csv")
#     df = pd.read_csv(csv_path)

#     # Convert to string to avoid nan issues, and handle potential missing columns
#     df.fillna('', inplace=True)
#     df = df.head(100) # LIMIT to 100 for faster loading during dev

#     docs = []

#     for _, row in df.iterrows():
#         # Using actual column names from medicine.csv
#         brand_name = row.get('brand name', '')
#         generic = row.get('generic', '')
#         strength = row.get('strength', '')
#         manufacturer = row.get('manufacturer', '')
#         dosage_form = row.get('dosage form', '')
        
#         text = f"""
#         Brand: {brand_name}
#         Generic: {generic}
#         Strength: {strength}
#         Manufacturer: {manufacturer}
#         Dosage: {dosage_form}
#         """

#         # Prepare metadata, cast all to string or int/float
#         metadata = {}
#         for k, v in row.to_dict().items():
#             if isinstance(v, str):
#                 metadata[str(k)] = v
#             else:
#                 metadata[str(k)] = str(v)

#         doc_id = str(row.get("brand id", ""))
        
#         # skip if doc_id is empty
#         if not doc_id:
#             continue

#         docs.append({
#             "id": doc_id,
#             "text": text,
#             "metadata": metadata
#         })

#     return docs
