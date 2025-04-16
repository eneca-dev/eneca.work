import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface UserState {
  id: string | null
  email: string | null
  name: string | null
  isAuthenticated: boolean
}

const initialState: UserState = {
  id: null,
  email: null,
  name: null,
  isAuthenticated: false,
}

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<{ id: string; email: string; name: string }>) {
      state.id = action.payload.id
      state.email = action.payload.email
      state.name = action.payload.name
      state.isAuthenticated = true
    },
    clearUser(state) {
      state.id = null
      state.email = null
      state.name = null
      state.isAuthenticated = false
    },
  },
})

export const { setUser, clearUser } = userSlice.actions
export default userSlice.reducer 