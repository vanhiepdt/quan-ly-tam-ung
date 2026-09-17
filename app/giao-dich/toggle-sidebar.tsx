'use client'
import { useState, useEffect } from 'react'

export function ToggleSidebar() {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    // Load saved preference from localStorage
    const saved = localStorage.getItem('sidebar-hidden')
    if (saved === 'true') {
      setHidden(true)
      document.querySelector('.app-shell')?.classList.add('sidebar-hidden')
    }
  }, [])

  const toggle = () => {
    const newState = !hidden
    setHidden(newState)
    const shell = document.querySelector('.app-shell')
    if (newState) {
      shell?.classList.add('sidebar-hidden')
    } else {
      shell?.classList.remove('sidebar-hidden')
    }
    localStorage.setItem('sidebar-hidden', String(newState))
  }

  return (
    <button
      className="toggle-sidebar"
      onClick={toggle}
      title={hidden ? 'Hiện sidebar' : 'Ẩn sidebar'}
      aria-label={hidden ? 'Hiện sidebar' : 'Ẩn sidebar'}
    >
      {hidden ? '▶' : '◀'}
    </button>
  )
}
