import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom'
import { DEMO } from './api'
import Layout from './components/Layout'
import { UIProvider } from './context/UIContext'
import AdminApp from './admin/AdminApp'
import Contact from './pages/Contact'
import EventDetail from './pages/EventDetail'
import Home from './pages/Home'
import NewsDetail from './pages/NewsDetail'
import NewsEvents from './pages/NewsEvents'
import NotFound from './pages/NotFound'
import Opportunities from './pages/Opportunities'
import OpportunityDetail from './pages/OpportunityDetail'
import Services from './pages/Services'
import './styles/fonts.js'
import './styles/base.css'
import './styles/sections.css'
import './styles/pages.css'

// The static demo uses hash routing so deep links work on any static host.
const Router = DEMO ? HashRouter : BrowserRouter

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <UIProvider>
        <Routes>
          <Route path="admin/*" element={<AdminApp />} />
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="opportunities" element={<Opportunities />} />
            <Route path="opportunities/:slug" element={<OpportunityDetail />} />
            <Route path="services" element={<Services />} />
            <Route path="news-events" element={<NewsEvents />} />
            <Route path="news/:slug" element={<NewsDetail />} />
            <Route path="events/:slug" element={<EventDetail />} />
            <Route path="contact" element={<Contact />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </UIProvider>
    </Router>
  </React.StrictMode>,
)
