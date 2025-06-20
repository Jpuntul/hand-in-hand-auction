import { render } from './setupTests'
import LoginPage from '../pages/LoginPage'
import { describe, it } from 'vitest'

describe('LoginPage', () => {
  it('renders without crashing', () => {
    render(<LoginPage />)
  })
})
