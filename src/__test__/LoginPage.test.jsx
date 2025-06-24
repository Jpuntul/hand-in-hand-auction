import { render } from './setupTests'
import Login from '../pages/LoginPage'
import { describe, it } from 'vitest'

describe('LoginPage', () => {
  it('renders without crashing', () => {
    render(<Login />)
  })
})
