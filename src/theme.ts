import { darkTheme, type GlobalThemeOverrides } from 'naive-ui'

/**
 * Naive UI overrides. Naive derives rgba variants from many of these colors via
 * seemly, so they MUST be concrete hex values (a `var(--…)` string throws
 * "[seemly/rgba]: Invalid color value"). Hex values mirror theme-tokens.css.
 * Only fontFamily stays a var() (Naive uses it verbatim, no rgba derivation).
 */
export const themeOverrides: GlobalThemeOverrides = {
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

export { darkTheme }
