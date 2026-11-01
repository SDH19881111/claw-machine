import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

if (import.meta.env.DEV) import('./dev/autotest')

createRoot(document.getElementById('root')).render(<App />)
