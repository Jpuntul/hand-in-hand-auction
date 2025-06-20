import { beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

// Mock Firebase modules globally
vi.mock('firebase/app', () => ({ initializeApp: () => ({}) }))
vi.mock('firebase/analytics', () => ({ getAnalytics: () => ({}) }))
vi.mock('firebase/firestore', () => ({ getFirestore: () => ({}) }))
vi.mock('firebase/auth', () => ({ getAuth: () => ({}) }))
vi.mock('firebase/storage', () => ({ getStorage: () => ({}) }))
vi.mock('firebase/functions', () => ({ getFunctions: () => ({}) }))

// Custom render wrapper to use MemoryRouter automatically
import { render as rtlRender } from '@testing-library/react'

function render(ui, options) {
  return rtlRender(ui, { wrapper: MemoryRouter, ...options })
}

// Export your custom render for all tests to use
export { render }

// Cleanup after each test
beforeEach(() => {
  cleanup()
})
