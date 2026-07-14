import { darkTheme, type GlobalThemeOverrides } from 'naive-ui'

/**
 * Naive UI overrides. Naive derives rgba variants from many of these colors via
 * seemly, so they MUST be concrete hex values (a `var(--…)` string throws
 * "[seemly/rgba]: Invalid color value"). Hex values mirror theme-tokens.css.
 * Only fontFamily stays a var() (Naive uses it verbatim, no rgba derivation).
 */

const darkOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#7c9eff',
    primaryColorHover: '#8badff',
    primaryColorPressed: '#6a8ae6',
    primaryColorSuppl: '#7c9eff',
    bodyColor: '#0d0d0f',
    cardColor: '#161618',
    modalColor: '#161618',
    popoverColor: '#1d1d20',
    inputColor: '#1d1d20',
    tableColor: '#161618',
    tableHeaderColor: '#1d1d20',
    borderColor: '#26262b',
    dividerColor: '#26262b',
    textColorBase: '#e6e6e8',
    textColor1: '#e6e6e8',
    textColor2: '#9a9aa2',
    textColor3: '#6b6b73',
    fontFamily: 'var(--sans)',
    fontFamilyMono: 'var(--mono)',
    borderRadius: '8px',
    borderRadiusSmall: '6px',
    fontWeightStrong: '600',
  },
}

const lightOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#5a7ce0',
    primaryColorHover: '#6e8ee6',
    primaryColorPressed: '#4a6cd0',
    primaryColorSuppl: '#5a7ce0',
    bodyColor: '#fbfbfc',
    cardColor: '#ffffff',
    modalColor: '#ffffff',
    popoverColor: '#f1f1f3',
    inputColor: '#f1f1f3',
    tableColor: '#ffffff',
    tableHeaderColor: '#f1f1f3',
    borderColor: '#e4e4e7',
    dividerColor: '#e4e4e7',
    textColorBase: '#1a1a1c',
    textColor1: '#1a1a1c',
    textColor2: '#5a5a62',
    textColor3: '#8a8a92',
    fontFamily: 'var(--sans)',
    fontFamilyMono: 'var(--mono)',
    borderRadius: '8px',
    borderRadiusSmall: '6px',
    fontWeightStrong: '600',
  },
}

export function getThemeOverrides(t: 'dark' | 'light'): GlobalThemeOverrides {
  return t === 'dark' ? darkOverrides : lightOverrides
}

export { darkTheme }
