import { render } from './setupTests'
import BiddingRoom from '../pages/BiddingRoomPage'
import { describe, it } from 'vitest'

describe('BiddingRoomPage', () => {
  it('renders without crashing', () => {
    render(<BiddingRoom />)
  })
})