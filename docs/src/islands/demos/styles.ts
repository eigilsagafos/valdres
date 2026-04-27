// Shared styles for all demos
export const demoContainerStyle = `
    border-radius: 12px;
    border: 1px solid oklch(0.7 0.18 80 / 0.3);
    background: oklch(0.7 0.18 80 / 0.05);
    padding: 24px;
    margin: 24px 0;
    font-family: Inter, system-ui, sans-serif;
`

export const demoLabelStyle = `
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: oklch(0.7 0.18 80);
    margin-bottom: 16px;
`

export const buttonStyle = `
    padding: 6px 16px;
    border-radius: 8px;
    border: 1px solid oklch(0.7 0.18 80 / 0.4);
    background: oklch(0.7 0.18 80 / 0.1);
    color: inherit;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.15s ease;
    font-family: inherit;
`

export const buttonActiveStyle = `
    background: oklch(0.7 0.18 80 / 0.2);
    border-color: oklch(0.7 0.18 80 / 0.6);
`

export const valueStyle = `
    font-size: 32px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: oklch(0.7 0.18 80);
`

export const inputStyle = `
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid oklch(0.5 0 0 / 0.2);
    background: transparent;
    color: inherit;
    font-size: 14px;
    font-family: inherit;
    outline: none;
    width: 200px;
`

export const secondaryTextStyle = `
    font-size: 13px;
    color: oklch(0.6 0 0);
`
