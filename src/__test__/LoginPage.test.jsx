import { render } from '@testing-library/react'
import LoginPage from '../pages/LoginPage'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

// Mock firebase as before if needed
vi.mock('firebase/app', () => ({ initializeApp: () => ({}) }))
vi.mock('firebase/analytics', () => ({ getAnalytics: () => ({}) }))
vi.mock('firebase/firestore', () => ({ getFirestore: () => ({}) }))
vi.mock('firebase/auth', () => ({ getAuth: () => ({}) }))
vi.mock('firebase/storage', () => ({ getStorage: () => ({}) }))
vi.mock('firebase/functions', () => ({ getFunctions: () => ({}) }))

describe('LoginPage', () => {
  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )
  })
})
