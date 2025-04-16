import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface SettingsState {
  theme: 'light' | 'dark' | 'system'
}

const initialState: SettingsState = {
  theme: 'system',
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<'light' | 'dark' | 'system'>) {
      state.theme = action.payload
    },
  },
})

export const { setTheme } = settingsSlice.actions
export default settingsSlice.reducer 