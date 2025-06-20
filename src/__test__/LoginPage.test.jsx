import { render } from '@testing-library/react'
import LoginPage from '../pages/LoginPage'

describe('LoginPage', () => {
  it('renders without crashing', () => {
    render(<LoginPage />)
  })
})
