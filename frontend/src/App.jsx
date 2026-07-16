import Chat from './Chat'
import Login from './Login'
import DocsPage from './DocsPage'
import { useAuth } from './AuthContext'
import './App.css'

function App() {
  const { user, loading } = useAuth();

  const path = window.location.pathname;

  if (path === '/docs') {
    // Docs handles its own access control
    return <DocsPage />;
  }

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app-container">
      <Chat />
    </div>
  )
}

export default App
