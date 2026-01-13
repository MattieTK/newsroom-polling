import { Routes, Route, Link, Navigate } from 'react-router-dom'
import PollList from './pages/PollList'
import PollCreate from './pages/PollCreate'
import PollDetail from './pages/PollDetail'
import PollEdit from './pages/PollEdit'

function App() {
  return (
    <div className="app">
      <header className="header">
        <div className="container header-content">
          <h1>
            <Link to="/polls" style={{ color: 'inherit', textDecoration: 'none' }}>
              Poll CMS
            </Link>
          </h1>
          <nav>
            <Link to="/polls">All Polls</Link>
            <Link to="/polls/new">Create Poll</Link>
          </nav>
        </div>
      </header>

      <main className="container">
        <Routes>
          <Route path="/" element={<Navigate to="/polls" replace />} />
          <Route path="/polls" element={<PollList />} />
          <Route path="/polls/new" element={<PollCreate />} />
          <Route path="/polls/:pollId" element={<PollDetail />} />
          <Route path="/polls/:pollId/edit" element={<PollEdit />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
