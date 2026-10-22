export function renderCockpitHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#0030FF" />
  <title>SM Retail, Inc. — SAP Integration Testing &amp; Metadata Suite</title>
  <style>
    @font-face {
      font-family: 'HenrySans';
      font-style: normal;
      font-weight: 700;
      font-display: swap;
      src: url("https://www.shopsm.com/venia-static/fonts/HenrySans-Bold.ttf") format("truetype");
    }
    @font-face {
      font-family: 'HenrySans';
      font-style: normal;
      font-weight: 600;
      font-display: swap;
      src: url("https://www.shopsm.com/venia-static/fonts/HenrySans-Bold.ttf") format("truetype");
    }
    @font-face {
      font-family: 'HenrySans';
      font-style: normal;
      font-weight: 500;
      font-display: swap;
      src: url("https://www.shopsm.com/venia-static/fonts/HenrySans-Medium.ttf") format("truetype");
    }
    @font-face {
      font-family: 'HenrySans';
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url("https://www.shopsm.com/venia-static/fonts/HenrySans-Regular.ttf") format("truetype");
    }
    @font-face {
      font-family: 'HenrySans';
      font-style: normal;
      font-weight: 300;
      font-display: swap;
      src: url("https://www.shopsm.com/venia-static/fonts/HenrySans-Light.ttf") format("truetype");
    }

    :root {
      --sm-blue: #0030FF;
      --sm-blue-hover: #0026cc;
      --sm-blue-tint: #eff3ff;
      --bg-page: #f9fafb;
      --bg-surface: #ffffff;
      --bg-subtle: #f3f4f6;
      --border-color: #e5e7eb;
      --border-input: #d1d5db;
      --text-primary: #111827;
      --text-secondary: #4b5563;
      --text-muted: #6b7280;
      --text-faint: #9ca3af;
      --status-green-bg: #ecfdf5;
      --status-green-text: #065f46;
      --status-green-border: #a7f3d0;
      --status-amber-bg: #fffbeb;
      --status-amber-text: #92400e;
      --status-amber-border: #fde68a;
      --status-red-bg: #fef2f2;
      --status-red-text: #991b1b;
      --status-red-border: #fecaca;
      --font-sans: 'HenrySans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    }

    html.dark {
      --sm-blue: #3b82f6;
      --sm-blue-hover: #2563eb;
      --sm-blue-tint: rgba(59, 130, 246, 0.15);
      --bg-page: #111827;
      --bg-surface: #1f2937;
      --bg-subtle: #111827;
      --border-color: #374151;
      --border-input: #4b5563;
      --text-primary: #f3f4f6;
      --text-secondary: #d1d5db;
      --text-muted: #9ca3af;
      --text-faint: #6b7280;
      --status-green-bg: rgba(6, 95, 70, 0.25);
      --status-green-text: #6ee7b7;
      --status-green-border: rgba(16, 185, 129, 0.4);
      --status-amber-bg: rgba(146, 64, 14, 0.25);
      --status-amber-text: #fcd34d;
      --status-amber-border: rgba(245, 158, 11, 0.4);
      --status-red-bg: rgba(153, 27, 27, 0.25);
      --status-red-text: #fca5a5;
      --status-red-border: rgba(239, 68, 68, 0.4);
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background-color: var(--bg-page);
      color: var(--text-primary);
      font-family: var(--font-sans);
      font-size: 13px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    /* Top Navigation Bar (Matches sap-po-ico-reader/+layout.svelte) */
    .navbar {
      background-color: var(--bg-surface);
      border-bottom: 1px solid var(--border-color);
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03);
    }
    .navbar-inner {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 24px;
      height: 54px;
      display: flex;
      align-items: center;
      gap: 28px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: var(--text-primary);
    }
    .brand-logo {
      width: 28px;
      height: 28px;
      flex-shrink: 0;
    }
    .brand-title {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--text-primary);
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 24px;
      height: 100%;
    }
    .nav-link {
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      height: 100%;
      padding: 0 2px;
      font-family: var(--font-sans);
      font-size: 13.5px;
      font-weight: 500;
      color: var(--text-muted);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: color 0.15s ease, border-color 0.15s ease;
    }
    .nav-link:hover {
      color: var(--text-primary);
    }
    .nav-link.active {
      color: var(--sm-blue);
      border-bottom-color: var(--sm-blue);
      font-weight: 600;
    }
    .nav-right {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .theme-btn {
      background: transparent;
      border: 1px solid transparent;
      border-radius: 6px;
      padding: 6px;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .theme-btn:hover {
      background-color: var(--bg-subtle);
      color: var(--text-primary);
    }

    /* Main Container */
    .container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 24px;
    }
    .step-pane {
      display: none;
    }
    .step-pane.active {
      display: block;
    }

    /* Headings */
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
      gap: 16px;
    }
    .page-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }
    .page-subtitle {
      font-size: 13px;
      color: var(--text-muted);
      margin: 3px 0 0 0;
    }

    /* Cards */
    .card {
      background-color: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03);
    }
    .card-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 14px 0;
    }

    /* Forms */
    .form-group {
      margin-bottom: 14px;
    }
    .form-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: 5px;
    }
    .input, select, textarea {
      width: 100%;
      border-radius: 6px;
      border: 1px solid var(--border-input);
      background-color: var(--bg-surface);
      color: var(--text-primary);
      padding: 8px 11px;
      font-family: var(--font-sans);
      font-size: 13px;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: var(--sm-blue);
      box-shadow: 0 0 0 1px var(--sm-blue);
    }
    .mono {
      font-family: var(--font-mono);
      font-size: 12px;
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border-radius: 6px;
      padding: 8px 14px;
      font-family: var(--font-sans);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      transition: background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .btn-primary {
      background-color: var(--sm-blue);
      color: #ffffff;
    }
    .btn-primary:hover:not(:disabled) {
      background-color: var(--sm-blue-hover);
    }
    .btn-secondary {
      background-color: var(--bg-surface);
      border-color: var(--border-input);
      color: var(--text-secondary);
    }
    .btn-secondary:hover:not(:disabled) {
      background-color: var(--bg-subtle);
      color: var(--text-primary);
    }
    .btn-danger {
      background-color: #dc2626;
      color: #ffffff;
    }
    .btn-sm {
      padding: 5px 10px;
      font-size: 12px;
    }

    /* Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 9999px;
      padding: 2px 9px;
      font-size: 11.5px;
      font-weight: 500;
    }
    .badge-blue {
      background-color: var(--sm-blue-tint);
      color: var(--sm-blue);
    }
    .badge-gray {
      background-color: var(--bg-subtle);
      color: var(--text-secondary);
      border: 1px solid var(--border-color);
    }
    .badge-green {
      background-color: var(--status-green-bg);
      color: var(--status-green-text);
      border: 1px solid var(--status-green-border);
    }
    .badge-amber {
      background-color: var(--status-amber-bg);
      color: var(--status-amber-text);
      border: 1px solid var(--status-amber-border);
    }
    .badge-red {
      background-color: var(--status-red-bg);
      color: var(--status-red-text);
      border: 1px solid var(--status-red-border);
    }

    /* Sub-tabs (Matches sap-po-ico-reader inventory sub-tabs) */
    .subtabs {
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: 12px;
    }
    .subtab-btn {
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      padding: 8px 14px;
      font-family: var(--font-sans);
      font-size: 13px;
      font-weight: 500;
      color: var(--text-muted);
      cursor: pointer;
    }
    .subtab-btn:hover {
      color: var(--text-primary);
    }
    .subtab-btn.active {
      color: var(--sm-blue);
      border-bottom-color: var(--sm-blue);
    }

    /* Tables */
    .table-wrap {
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background-color: var(--bg-surface);
      overflow: hidden;
    }
    table.clean-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
    }
    table.clean-table th,
    table.clean-table td {
      padding: 9px 12px;
      text-align: left;
      border-bottom: 1px solid var(--border-color);
    }
    table.clean-table th {
      background-color: var(--bg-subtle);
      color: var(--text-muted);
      font-weight: 600;
      font-size: 11.5px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    table.clean-table tbody tr {
      cursor: pointer;
      transition: background-color 0.1s ease;
    }
    table.clean-table tbody tr:hover {
      background-color: var(--bg-subtle);
    }
    table.clean-table tbody tr.selected {
      background-color: var(--sm-blue-tint);
    }
    table.clean-table tbody tr:last-child td {
      border-bottom: none;
    }

    /* Detail Inspector Rows (Matches sap-po-ico-reader detail panel) */
    .detail-section-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-faint);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 14px 0 4px 0;
    }
    .detail-section-title:first-of-type {
      margin-top: 0;
    }
    .detail-row {
      display: flex;
      gap: 8px;
      padding: 5px 0;
      border-bottom: 1px solid var(--border-color);
      font-size: 12px;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      width: 110px;
      flex-shrink: 0;
      color: var(--text-muted);
    }
    .detail-val {
      color: var(--text-primary);
      word-break: break-all;
      min-width: 0;
    }

    /* Grid Helpers */
    .grid-extract {
      display: grid;
      grid-template-columns: 380px 1fr;
      gap: 20px;
      align-items: start;
    }
    .grid-generator {
      display: grid;
      grid-template-columns: 400px 1fr;
      gap: 20px;
      align-items: start;
    }
    @media (max-width: 1024px) {
      .grid-extract, .grid-generator {
        grid-template-columns: 1fr;
      }
    }

    pre.code-block {
      background-color: var(--bg-subtle);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 14px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-primary);
      overflow-x: auto;
      max-height: 460px;
      margin: 0;
      white-space: pre;
    }

    .segmented {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      border: 1px solid var(--border-input);
      border-radius: 6px;
      overflow: hidden;
      background-color: var(--bg-subtle);
    }
    .segmented-btn {
      background: transparent;
      border: none;
      border-right: 1px solid var(--border-input);
      padding: 7px 8px;
      font-family: var(--font-sans);
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary);
      cursor: pointer;
    }
    .segmented-btn:last-child {
      border-right: none;
    }
    .segmented-btn.active {
      background-color: var(--sm-blue);
      color: #ffffff;
      font-weight: 600;
    }

    .status-banner {
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 13px;
      margin-bottom: 14px;
    }

    /* Searchable Interface Combobox */
    .combobox-wrap {
      position: relative;
    }
    .combobox-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .combobox-input {
      width: 100%;
      background-color: var(--bg-surface);
      border: 1px solid var(--border-input);
      border-radius: 6px;
      padding: 7px 56px 7px 11px;
      font-family: var(--font-mono);
      font-size: 12.5px;
      color: var(--text-primary);
      outline: none;
      transition: border-color 0.12s, box-shadow 0.12s;
    }
    .combobox-input:focus {
      border-color: var(--sm-blue);
      box-shadow: 0 0 0 2px var(--sm-blue-soft);
    }
    .combobox-actions {
      position: absolute;
      right: 6px;
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .combobox-icon-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 3px 5px;
      border-radius: 4px;
      font-size: 12px;
      line-height: 1;
    }
    .combobox-icon-btn:hover {
      background-color: var(--bg-subtle);
      color: var(--text-primary);
    }
    .combobox-popover {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      background-color: var(--bg-surface);
      border: 1px solid var(--border-input);
      border-radius: 6px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      max-height: 250px;
      overflow-y: auto;
      z-index: 60;
      display: none;
    }
    .combobox-popover.open {
      display: block;
    }
    .combobox-option {
      padding: 8px 11px;
      border-bottom: 1px solid var(--border-color);
      cursor: pointer;
      transition: background-color 0.1s;
    }
    .combobox-option:last-child {
      border-bottom: none;
    }
    .combobox-option:hover,
    .combobox-option.selected {
      background-color: var(--bg-subtle);
    }
    .combobox-option.selected {
      border-left: 3px solid var(--sm-blue);
      padding-left: 8px;
    }
  </style>
</head>
<body>

  <!-- Top Navigation Bar (Identical structure & SM monogram to sap-po-ico-reader) -->
  <nav class="navbar">
    <div class="navbar-inner">
      <div class="brand">
        <!-- Official SM Retail Monogram from sap-po-ico-reader/src/lib/assets/logo.svg -->
        <svg class="brand-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
          <path fill="#0030FF" d="M 511.453125 255.726562 C 511.453125 114.492188 396.960938 0 255.726562 0 C 114.492188 0 0 114.492188 0 255.726562 C 0 396.960938 114.492188 511.453125 255.726562 511.453125 C 396.960938 511.453125 511.453125 396.960938 511.453125 255.726562 Z"/>
          <path fill="#FFFFFF" d="M 324.6875 299.117188 C 307.84375 299.117188 288.832031 287.609375 279.535156 260.605469 L 279.535156 420.375 L 303.148438 420.375 L 303.148438 315.308594 C 310.503906 320.226562 318.054688 321.535156 324.710938 321.535156 C 331.367188 321.535156 338.917969 320.226562 346.277344 315.308594 L 346.277344 420.375 L 369.890625 420.375 L 369.890625 260.605469 C 360.589844 287.609375 341.53125 299.117188 324.6875 299.117188 Z M 389.207031 87.667969 L 389.207031 420.375 L 412.820312 420.375 L 412.820312 87.667969 Z M 133.375 332.28125 C 134.425781 339.542969 136.992188 345.589844 140.46875 350.507812 C 145.1875 357.179688 151.027344 359.863281 158.808594 359.679688 C 170.304688 359.410156 176.164062 349.519531 176.78125 337.253906 C 177.425781 324.40625 172.980469 310.371094 165.058594 299.394531 C 161.425781 294.363281 155.546875 287.890625 146.609375 280.007812 C 137.519531 294.152344 130.480469 312.214844 133.375 332.28125 Z M 236.605469 87.667969 L 260.214844 87.667969 L 260.214844 420.375 L 236.605469 420.375 L 236.605469 371.605469 C 226.78125 397.492188 207.21875 415.8125 181.363281 423.265625 C 176.097656 424.785156 168.375 426.035156 159.355469 426.035156 C 144.855469 426.035156 126.984375 422.804688 110.488281 412.265625 C 95.085938 402.429688 75.125 383.066406 69.808594 344.207031 C 64.625 306.324219 79.832031 273.5 96.761719 250.699219 L 113.851562 261.039062 C 99.507812 283.609375 88.378906 306.964844 92.921875 340.597656 C 95.957031 363.0625 106.796875 381.847656 123.21875 392.339844 C 136.28125 400.683594 150.050781 402.4375 159.304688 402.4375 C 164.984375 402.4375 170.640625 401.746094 174.8125 400.542969 C 193.6875 395.101562 207.9375 381.453125 214.9375 362.113281 C 224.507812 335.660156 219.367188 302.871094 201.515625 276.539062 C 191.519531 261.792969 168.746094 241.371094 155.113281 229.144531 C 151.378906 225.796875 148.15625 222.90625 146.59375 221.371094 C 122.660156 197.855469 113.835938 178.417969 117.078125 156.375 C 119.148438 142.304688 130.25 130.050781 143.480469 127.242188 C 154.886719 124.820312 166.273438 127.320312 176.414062 134.484375 C 191.078125 144.851562 201.335938 163.535156 205.144531 185.472656 L 185.597656 190.371094 C 182.570312 174.921875 174.757812 154.027344 156.792969 149.964844 C 152.820312 149.070312 147.945312 149.898438 144.980469 152.175781 C 137.789062 157.6875 139.457031 169.707031 142.480469 177.089844 C 146.824219 187.691406 155.121094 196.59375 163.167969 204.503906 C 164.34375 205.660156 167.6875 208.65625 170.917969 211.550781 C 190.441406 229.042969 210.398438 247.449219 221.121094 263.308594 C 227.742188 273.113281 232.925781 283.679688 236.605469 294.574219 L 236.605469 177.59375 L 222.074219 181.230469 C 217.242188 154.730469 205.960938 131.839844 187.5 118.796875 C 172.875 108.460938 156.273438 104.882812 139.484375 108.449219 C 129.121094 110.652344 119.265625 116.492188 111.734375 124.898438 C 104.449219 133.027344 99.597656 143.210938 98.070312 153.578125 C 93.886719 182.003906 104.699219 207.140625 133.125 235.074219 C 135.003906 236.921875 138.226562 239.808594 142.304688 243.46875 C 154.410156 254.320312 176.9375 274.519531 185.613281 287.320312 C 199.855469 308.328125 204.273438 335.121094 196.871094 355.574219 C 193.4375 365.054688 185.902344 377.238281 169.492188 381.96875 C 164.730469 383.34375 147.902344 385.308594 133.5625 376.148438 C 121.996094 368.757812 114.382812 354.429688 111.910156 337.667969 C 109.734375 322.921875 111.171875 295.40625 130.703125 267.109375 L 131.644531 265.914062 C 126.265625 261.058594 118.820312 254.171875 116.550781 251.941406 C 95.226562 230.988281 67.683594 197.632812 74.671875 150.136719 C 79.332031 118.476562 103.960938 91.824219 134.566406 85.316406 C 157.636719 80.410156 179.480469 85.585938 199.496094 99.410156 C 216.007812 110.816406 229.46875 129.832031 236.605469 156.847656 Z M 324.6875 279.519531 C 328.882812 279.519531 336.675781 278.085938 343.195312 269.832031 C 355.550781 254.183594 369.75 235.621094 369.75 87.667969 L 346.277344 87.667969 C 346.277344 131.785156 344.746094 172.789062 341.09375 201.585938 C 336.105469 240.894531 330.722656 256.046875 324.75 256.046875 C 318.773438 256.046875 313.390625 240.894531 308.40625 201.585938 C 304.75 172.789062 303.21875 131.785156 303.21875 87.667969 L 279.746094 87.667969 C 279.746094 235.621094 293.949219 254.183594 306.300781 269.832031 C 312.820312 278.085938 320.613281 279.519531 324.6875 279.519531 Z"/>
        </svg>
        <span class="brand-title">SM Retail, Inc. — Integration Testing &amp; Metadata Suite</span>
      </div>

      <!-- Execution-Order Navigation -->
      <div class="nav-links">
        <button class="nav-link active" id="navStep1" onclick="switchStep(1)">
          1. Metadata Extraction
        </button>
        <button class="nav-link" id="navStep2" onclick="switchStep(2)">
          2. Payload Generation
        </button>
        <button class="nav-link" id="navStep3" onclick="switchStep(3)">
          3. Execution &amp; Parity
        </button>
      </div>

      <div class="nav-right">
        <span class="badge badge-gray" id="activeEnvBadge">Environment: SPD (Development)</span>
        <button class="theme-btn" onclick="toggleTheme()" title="Toggle light/dark theme">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
          </svg>
        </button>
      </div>
    </div>
  </nav>

  <!-- Main Workspace -->
  <main class="container">

    <!-- =================================================================== -->
    <!-- STEP 1: SELECT ENVIRONMENT (MINIMAL CENTERED PREREQUISITE CARD)     -->
    <!-- =================================================================== -->
    <section id="step-1" class="step-pane active">
      <div style="max-width: 460px; margin: 48px auto 0;">
        <div class="card" style="padding: 28px;">
          <h1 class="page-title" style="font-size: 17px; margin-bottom: 4px;">Select Environment</h1>
          <p class="page-subtitle" style="margin-bottom: 20px;">
            Choose the target SAP environment to load interface definitions and mapping metadata.
          </p>

          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label" for="hostSelect">Target Environment</label>
            <select id="hostSelect" onchange="onChangeEnvironment()"></select>
          </div>

          <div style="background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: 6px; padding: 12px 14px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; font-weight: 500; color: var(--text-primary); font-size: 12.5px;">
                <span id="envStatusDot" style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
                <span id="envStatusText">Snapshot ready · 5 interfaces available</span>
              </div>
              <div id="envStatusSub" style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px; padding-left: 15px;">
                Last synced Oct 22, 2026
              </div>
            </div>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              id="refreshEnvBtn"
              onclick="refreshEnvironmentMetadata()"
              style="flex-shrink: 0;"
            >
              Refresh
            </button>
          </div>

          <button class="btn btn-primary" style="width: 100%; padding: 10px 16px;" onclick="switchStep(2)">
            Continue to Payload Generation &rarr;
          </button>
        </div>
      </div>
    </section>

    <!-- =================================================================== -->
    <!-- STEP 2: PAYLOAD GENERATION (3-LAYER XML & FLAT-FILE GENERATOR)      -->
    <!-- =================================================================== -->
    <section id="step-2" class="step-pane">
      <div class="page-header">
        <div>
          <h1 class="page-title">Test Payload &amp; Scenario Generation</h1>
          <p class="page-subtitle">Synthesize schema-compliant XML payloads, ESR mapping rules, and flat files from extracted interface metadata.</p>
        </div>
        <div class="subtabs" style="margin-bottom:0; border-bottom:none;">
          <button class="btn btn-primary btn-sm" id="modeXmlBtn" onclick="switchGenMode('xml')">3-Layer XML Mapping Generator</button>
          <button class="btn btn-secondary btn-sm" id="modeFccBtn" onclick="switchGenMode('fcc')">Flat-File (FCC) &amp; Post-FCC Generator</button>
        </div>
      </div>

      <!-- Mode A: 3-Layer XML Mapping Payload Generator -->
      <div id="genModeXmlPane" class="grid-generator">
        <div>
          <div class="card">
            <h2 class="card-title">Generation Parameters</h2>

            <div class="form-group">
              <label class="form-label" for="interfaceSearchInput">Sender Interface</label>
              <div class="combobox-wrap" id="interfaceComboboxWrap">
                <input type="hidden" id="interfaceSelect" value="" />
                <div class="combobox-input-wrap">
                  <input
                    type="text"
                    id="interfaceSearchInput"
                    class="combobox-input"
                    value=""
                    placeholder="Type or select sender interface..."
                    autocomplete="off"
                    onfocus="openInterfaceCombobox(false)"
                    oninput="filterInterfaceCombobox(this.value)"
                    onkeydown="handleInterfaceComboboxKey(event)"
                  />
                  <div class="combobox-actions">
                    <button
                      type="button"
                      class="combobox-icon-btn"
                      title="Clear selection"
                      onclick="clearInterfaceSearch()"
                    >&times;</button>
                    <button
                      type="button"
                      class="combobox-icon-btn"
                      title="Toggle interface list"
                      onclick="toggleInterfaceCombobox()"
                    >&#9662;</button>
                  </div>
                </div>
                <div id="interfaceDropdownList" class="combobox-popover"></div>
              </div>
            </div>

            <!-- Interface-Scoped Load / Save Scenario Controls -->
            <div class="form-group" style="background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px 12px;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div style="min-width: 0;">
                  <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.03em;">Scenario Case</div>
                  <div id="activeScenarioLabel" class="mono" style="font-size: 12px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">None loaded</div>
                </div>
                <div style="display: flex; gap: 6px; flex-shrink: 0;">
                  <button type="button" class="btn btn-secondary btn-sm" onclick="toggleLoadScenarioDrawer()">Load</button>
                  <button type="button" class="btn btn-secondary btn-sm" onclick="toggleSaveScenarioDrawer()">Save</button>
                </div>
              </div>

              <!-- Inline Load Drawer (Filtered by selected interface + local file picker) -->
              <div id="loadScenarioDrawer" style="display: none; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color);">
                <div style="font-size: 11.5px; font-weight: 500; color: var(--text-secondary); margin-bottom: 6px;">
                  Saved cases for this interface:
                </div>
                <div id="interfaceScenariosList" style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;"></div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label class="btn btn-secondary btn-sm" style="cursor: pointer; font-size: 11.5px; padding: 4px 8px;">
                    Browse .yaml / .json file...
                    <input type="file" id="scenarioFileInput" accept=".yaml,.yml,.json" style="display: none;" onchange="loadScenarioFromFile(event)" />
                  </label>
                  <button type="button" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 11.5px;" onclick="toggleLoadScenarioDrawer(false)">Close</button>
                </div>
              </div>

              <!-- Inline Save Drawer -->
              <div id="saveScenarioDrawer" style="display: none; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color);">
                <label class="form-label" style="font-size: 11.5px;">Scenario Name / Filename</label>
                <div style="display: flex; gap: 6px;">
                  <input type="text" id="saveScenarioNameInput" class="input mono" placeholder="e.g. minimal-batch.scenario.yaml" style="padding: 5px 8px; font-size: 12px;" />
                  <button type="button" class="btn btn-primary btn-sm" onclick="saveCurrentScenario()">Confirm Save</button>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Synthesis Layer</label>
              <div class="segmented">
                <button type="button" class="segmented-btn" id="layerBtn1" onclick="setLayer(1)">Layer 1: Schema</button>
                <button type="button" class="segmented-btn" id="layerBtn2" onclick="setLayer(2)">Layer 2: Mapping</button>
                <button type="button" class="segmented-btn active" id="layerBtn3" onclick="setLayer(3)">Layer 3: Macros</button>
              </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="form-label">Detail Record Count</label>
                <input type="number" id="repeatCountInput" class="input" value="3" min="1" max="50" onchange="runMappingGeneration()" />
              </div>
              <div class="form-group">
                <label class="form-label">Optional Fields</label>
                <select id="allOptionalSelect" onchange="runMappingGeneration()">
                  <option value="false">Minimal Required Only</option>
                  <option value="true">Populate All Optional</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <label class="form-label" style="margin-bottom:0;">Field Overrides (KEY=VALUE)</label>
                <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:11px;" onclick="sanitizeCurrentOverrides()">
                  Sanitize Raw Values to Macros
                </button>
              </div>
              <textarea id="overridesTextarea" rows="7" class="mono"></textarea>
            </div>

            <div style="display:flex; gap:8px;">
              <button class="btn btn-primary" style="width:100%;" onclick="runMappingGeneration()">Generate XML Payload</button>
            </div>
          </div>
        </div>

        <div>
          <!-- Mapping & Target Schema Inspection Summary -->
          <div class="card" style="margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <h2 class="card-title" style="margin:0;">ESR Mapping &amp; Target Schema Cardinality Inspection</h2>
              <span class="badge badge-blue" id="genLayerBadge">Layer 3 Active</span>
            </div>

            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-bottom:14px;">
              <div style="padding:10px 12px; background:var(--bg-subtle); border-radius:6px; border:1px solid var(--border-color);">
                <div style="font-size:11px; color:var(--text-muted);">Message Mapping</div>
                <div class="mono" style="font-weight:600; margin-top:2px;" id="esrMappingName">—</div>
              </div>
              <div style="padding:10px 12px; background:var(--bg-subtle); border-radius:6px; border:1px solid var(--border-color);">
                <div style="font-size:11px; color:var(--text-muted);">Target Receiver Schema</div>
                <div class="mono" style="font-weight:600; margin-top:2px;" id="esrTargetMessage">—</div>
              </div>
              <div style="padding:10px 12px; background:var(--bg-subtle); border-radius:6px; border:1px solid var(--border-color);">
                <div style="font-size:11px; color:var(--text-muted);">Field Statistics</div>
                <div style="font-weight:600; margin-top:2px;" id="esrFieldStats">—</div>
              </div>
            </div>

            <div class="table-wrap" style="max-height:175px; overflow-y:auto;">
              <table class="clean-table">
                <thead>
                  <tr>
                    <th>Target Receiver Path</th>
                    <th>Cardinality</th>
                    <th>Mapped Sender Field(s)</th>
                  </tr>
                </thead>
                <tbody id="targetCardinalitiesBody"></tbody>
              </table>
            </div>
          </div>

          <!-- Generated XML Output -->
          <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <h2 class="card-title" style="margin:0;">Generated XML Payload</h2>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary btn-sm" onclick="copyText('xmlOutputPre')">Copy XML</button>
                <button class="btn btn-secondary btn-sm" onclick="downloadCurrentXml()">Download .xml</button>
                <button class="btn btn-primary btn-sm" onclick=" proceedToExecutionWithPayload()">Use in Step 3 &rarr;</button>
              </div>
            </div>
            <pre class="code-block" id="xmlOutputPre"></pre>
          </div>
        </div>
      </div>

      <!-- Mode B: Flat-File (FCC) & Post-FCC Generator -->
      <div id="genModeFccPane" style="display:none;">
        <div class="card" style="margin-bottom:16px;">
          <div style="display:grid; grid-template-columns: 2fr 1fr 1.5fr 1fr auto; gap:12px; align-items:end;">
            <div>
              <label class="form-label">Interface Specification</label>
              <select id="fccSpecSelect" onchange="runFlatFileGeneration()">
                <option value="dac-ap-invoice">I001_DAC_AP_Invoice_Out_Async (.DAC33)</option>
                <option value="lazada-ar-receipt">SI_I025_AR_Lazada_OB_AS (.csv)</option>
              </select>
            </div>
            <div>
              <label class="form-label">Detail Rows</label>
              <input type="number" id="fccCountInput" class="input" value="3" min="1" max="50" onchange="runFlatFileGeneration()" />
            </div>
            <div>
              <label class="form-label">Filename</label>
              <input type="text" id="fccFilenameInput" class="input" value="138100000531261.DAC33" />
            </div>
            <div>
              <label class="form-label">Batch Date (MMDDYYYY)</label>
              <input type="text" id="fccBatchDateInput" class="input" value="10222026" />
            </div>
            <div>
              <button class="btn btn-primary" onclick="runFlatFileGeneration()">Generate Files</button>
            </div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
          <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h3 class="card-title" style="margin:0;">Mode 2: Raw Flat File (<span id="fccFilenameLabel" class="mono">138100000531261.DAC33</span>)</h3>
              <span class="badge badge-green" id="fccComplianceBadge">Compliant</span>
            </div>
            <pre class="code-block" id="fccFlatOutputPre"></pre>
          </div>
          <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h3 class="card-title" style="margin:0;">Mode 1: Post-FCC XML</h3>
              <button class="btn btn-secondary btn-sm" onclick="copyText('fccXmlOutputPre')">Copy XML</button>
            </div>
            <pre class="code-block" id="fccXmlOutputPre"></pre>
          </div>
        </div>
      </div>
    </section>

    <!-- =================================================================== -->
    <!-- STEP 3: EXECUTION & PARITY (WITH PLACEHOLDERS FOR UPCOMING MODULES) -->
    <!-- =================================================================== -->
    <section id="step-3" class="step-pane">
      <div class="page-header">
        <div>
          <h1 class="page-title">Test Execution &amp; Migration Parity</h1>
          <p class="page-subtitle">Compare SAP PI/PO 7.5 against SAP BTP Cloud Integration (CPI) responses and review upcoming execution modules.</p>
        </div>
      </div>

      <!-- Active Module: Canonical XML/JSON Parity Diff -->
      <div class="card" style="margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <h2 class="card-title" style="margin:0;">Canonical XML / JSON Parity Diff Engine</h2>
              <span class="badge badge-amber">BTP Live Connector: Planned Phase 2 (Offline Sample Mode)</span>
            </div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
              Demonstrates structural payload comparison with automated namespace prefix and volatile field stripping. Live BTP CPI dispatch is scheduled for Phase 2.
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary btn-sm" onclick="loadParityPreset('match')">Load Sample: Parity Match</button>
            <button class="btn btn-secondary btn-sm" onclick="loadParityPreset('mismatch')">Load Sample: Discrepancy</button>
            <button class="btn btn-primary btn-sm" onclick="runCanonicalDiff()">Compare Payloads</button>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:14px;">
          <div>
            <label class="form-label">SAP PI/PO 7.5 Payload</label>
            <textarea id="parityPayloadA" rows="9" class="mono"></textarea>
          </div>
          <div>
            <label class="form-label">SAP BTP Integration Suite (CPI) Payload</label>
            <textarea id="parityPayloadB" rows="9" class="mono"></textarea>
          </div>
        </div>

        <div id="parityResultBanner" class="status-banner"></div>

        <div id="parityDiffTableWrap" class="table-wrap" style="display:none;">
          <table class="clean-table">
            <thead>
              <tr>
                <th>Field Path</th>
                <th>Reason</th>
                <th>SAP PI/PO Expected</th>
                <th>SAP BTP CPI Actual</th>
              </tr>
            </thead>
            <tbody id="parityDiffTableBody"></tbody>
          </table>
        </div>
      </div>

      <!-- Upcoming Roadmap Placeholders -->
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h2 class="card-title" style="margin:0;">Planned Execution &amp; Operations Modules (Placeholders)</h2>
          <span class="badge badge-amber">Roadmap Phase 1.5 – 3</span>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:14px;">
          <div style="border:1px dashed var(--border-input); border-radius:6px; padding:14px;">
            <div style="font-weight:600; color:var(--text-primary); margin-bottom:4px;">Cross-Environment Configuration Diff</div>
            <div style="font-size:12px; color:var(--text-muted);">Compare DEV, QA, and PRD channel parameters and ICO routing rules to detect configuration drift prior to transport.</div>
          </div>
          <div style="border:1px dashed var(--border-input); border-radius:6px; padding:14px;">
            <div style="font-weight:600; color:var(--text-primary); margin-bottom:4px;">Batch Smoke &amp; Stress Runner UI</div>
            <div style="font-size:12px; color:var(--text-muted);">Dispatch generated payloads across discovered MessageServlet endpoints and poll AdapterMessageMonitoring status.</div>
          </div>
          <div style="border:1px dashed var(--border-input); border-radius:6px; padding:14px;">
            <div style="font-weight:600; color:var(--text-primary); margin-bottom:4px;">SAP BTP CPI Live Artifact Extractor</div>
            <div style="font-size:12px; color:var(--text-muted);">Ingest BTP Cloud Integration iFlow bundles into the unified CanonicalScenario model alongside PI/PO ICOs.</div>
          </div>
          <div style="border:1px dashed var(--border-input); border-radius:6px; padding:14px;">
            <div style="font-weight:600; color:var(--text-primary); margin-bottom:4px;">Living Interface Passports (.xlsx / .docx)</div>
            <div style="font-size:12px; color:var(--text-muted);">Export interface matrices and functional/technical specifications directly from extracted environment snapshots.</div>
          </div>
        </div>
      </div>
    </section>

  </main>

  <script>
    let currentStep = 1;
    let currentLayer = 3;
    let currentInventory = null;
    let activeInventorySubtab = 'icos';
    let selectedIcoIndex = 0;
    let loadedScenarios = [];
    let availableInterfaces = [];
    let parityPresetsCache = {};
    let lastGeneratedInterface = 'I001_DAC_AP_Invoice_Out_Async';

    function switchStep(stepNum) {
      currentStep = stepNum;
      [1, 2, 3].forEach(n => {
        document.getElementById('step-' + n).classList.toggle('active', n === stepNum);
        document.getElementById('navStep' + n).classList.toggle('active', n === stepNum);
      });
    }

    function toggleTheme() {
      document.documentElement.classList.toggle('dark');
    }

    function onChangeEnvironment() {
      const sel = document.getElementById('hostSelect');
      const hostId = sel.value || 'spd100';
      const label = sel.options[sel.selectedIndex]?.textContent || hostId.toUpperCase();
      const shortCode = hostId.toUpperCase().replace('100', '');
      document.getElementById('activeEnvBadge').textContent = 'Environment: ' + shortCode;
      const count = availableInterfaces.length || 5;
      document.getElementById('envStatusText').textContent = 'Snapshot ready · ' + count + ' interfaces available';
      document.getElementById('envStatusSub').textContent = 'Loaded for ' + label.split('—')[0].trim();
      const countEl = document.getElementById('interfaceIndexCount');
      if (countEl) {
        countEl.textContent = count + ' indexed in ' + shortCode;
      }
    }

    async function refreshEnvironmentMetadata() {
      const btn = document.getElementById('refreshEnvBtn');
      const dot = document.getElementById('envStatusDot');
      const txt = document.getElementById('envStatusText');
      const sub = document.getElementById('envStatusSub');
      const hostId = document.getElementById('hostSelect').value;

      btn.disabled = true;
      btn.textContent = 'Syncing...';
      dot.style.background = '#f59e0b';
      txt.textContent = 'Syncing metadata from environment...';

      try {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hostId, extractIcos: true, extractChannels: true })
        });
        const data = await res.json();
        await new Promise(r => setTimeout(r, 400));
        const icos = data.inventory?.integratedConfigurations || [];
        if (icos.length > 0) {
          availableInterfaces = icos.map(ico => ({
            id: ico.senderInterface,
            label: ico.senderInterface,
            sender: ico.senderComponent,
            receiver: (ico.receiverComponents || []).join(', ') || '—',
            namespace: ico.interfaceNamespace,
            qos: ico.qualityOfService || 'EO',
            mapping: ico.operationMapping || 'Pass-Through'
          }));
          updateSelectedInterfaceMeta(document.getElementById('interfaceSelect').value);
        }
        const icoCount = availableInterfaces.length || 5;
        dot.style.background = '#10b981';
        txt.textContent = 'Snapshot ready · ' + icoCount + ' interfaces available';
        sub.textContent = 'Synced just now';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Refresh';
      }
    }

    function updateSelectedInterfaceMeta() {
      // No visual sub-metadata line under the input
    }

    function renderInterfaceComboboxOptions(queryText) {
      const listEl = document.getElementById('interfaceDropdownList');
      if (!listEl) return;
      const currentVal = document.getElementById('interfaceSelect').value;
      const q = (queryText || '').trim().toLowerCase();

      const filtered = availableInterfaces.filter(item => {
        if (!q) return true;
        return item.id.toLowerCase().includes(q);
      });

      listEl.innerHTML = '';
      if (filtered.length === 0) {
        listEl.innerHTML =
          '<div style="padding: 8px 11px; font-size: 12px; color: var(--text-muted);">' +
          'No matching interfaces found.' +
          '</div>';
        return;
      }

      filtered.forEach(item => {
        const div = document.createElement('div');
        div.className = 'combobox-option mono' + (item.id === currentVal ? ' selected' : '');
        div.style.fontSize = '12.5px';
        div.textContent = item.id;
        div.onmousedown = (e) => {
          e.preventDefault();
          selectInterfaceFromCombobox(item.id);
        };
        listEl.appendChild(div);
      });
    }

    function openInterfaceCombobox(showAll) {
      const listEl = document.getElementById('interfaceDropdownList');
      const inputEl = document.getElementById('interfaceSearchInput');
      if (!listEl || !inputEl) return;
      renderInterfaceComboboxOptions(showAll ? '' : inputEl.value);
      listEl.classList.add('open');
    }

    function toggleInterfaceCombobox() {
      const listEl = document.getElementById('interfaceDropdownList');
      if (!listEl) return;
      if (listEl.classList.contains('open')) {
        listEl.classList.remove('open');
      } else {
        openInterfaceCombobox(true);
        document.getElementById('interfaceSearchInput').focus();
      }
    }

    function clearInterfaceSearch() {
      const inputEl = document.getElementById('interfaceSearchInput');
      inputEl.value = '';
      document.getElementById('interfaceSelect').value = '';
      document.getElementById('activeScenarioLabel').textContent = 'None loaded';
      document.getElementById('overridesTextarea').value = '';
      resetMappingOutputPane();
      openInterfaceCombobox(true);
      inputEl.focus();
    }

    function filterInterfaceCombobox(val) {
      const listEl = document.getElementById('interfaceDropdownList');
      renderInterfaceComboboxOptions(val);
      listEl.classList.add('open');
    }

    function selectInterfaceFromCombobox(interfaceId) {
      document.getElementById('interfaceSelect').value = interfaceId;
      document.getElementById('interfaceSearchInput').value = interfaceId;
      document.getElementById('interfaceDropdownList').classList.remove('open');
      onChangeInterface();
    }

    function handleInterfaceComboboxKey(e) {
      const listEl = document.getElementById('interfaceDropdownList');
      if (e.key === 'Escape') {
        listEl.classList.remove('open');
        document.getElementById('interfaceSearchInput').value = document.getElementById('interfaceSelect').value;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const q = document.getElementById('interfaceSearchInput').value.trim();
        if (!q) return;
        const match = availableInterfaces.find(i =>
          i.id.toLowerCase().includes(q.toLowerCase())
        );
        selectInterfaceFromCombobox(match ? match.id : q);
      }
    }

    document.addEventListener('mousedown', (e) => {
      const wrap = document.getElementById('interfaceComboboxWrap');
      const listEl = document.getElementById('interfaceDropdownList');
      if (wrap && listEl && !wrap.contains(e.target)) {
        listEl.classList.remove('open');
        document.getElementById('interfaceSearchInput').value = document.getElementById('interfaceSelect').value;
      }
    });

    function switchGenMode(mode) {
      document.getElementById('genModeXmlPane').style.display = mode === 'xml' ? 'grid' : 'none';
      document.getElementById('genModeFccPane').style.display = mode === 'fcc' ? 'block' : 'none';
      document.getElementById('modeXmlBtn').className = mode === 'xml' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
      document.getElementById('modeFccBtn').className = mode === 'fcc' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
    }

    function setLayer(layerNum) {
      currentLayer = layerNum;
      [1, 2, 3].forEach(n => {
        document.getElementById('layerBtn' + n).classList.toggle('active', n === layerNum);
      });
      runMappingGeneration();
    }

    function parseOverridesTextarea() {
      const lines = document.getElementById('overridesTextarea').value.split(/\\r?\\n/);
      const out = {};
      for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const idx = line.indexOf('=');
        if (idx !== -1) {
          const k = line.slice(0, idx).trim();
          const v = line.slice(idx + 1).trim();
          if (k) out[k] = v;
        }
      }
      return out;
    }

    function formatOverridesToTextarea(overridesObj) {
      return Object.entries(overridesObj || {})
        .map(([k, v]) => k + '=' + v)
        .join('\\n');
    }

    function resetMappingOutputPane() {
      document.getElementById('esrMappingName').textContent = '—';
      document.getElementById('esrTargetMessage').textContent = '—';
      document.getElementById('esrFieldStats').textContent = '—';
      document.getElementById('targetCardinalitiesBody').innerHTML =
        '<tr><td colspan="3" style="color: var(--text-muted); font-size: 12px; padding: 10px 12px;">Select a sender interface to inspect target schema cardinalities.</td></tr>';
      document.getElementById('xmlOutputPre').textContent = '';
    }

    function onChangeInterface() {
      document.getElementById('loadScenarioDrawer').style.display = 'none';
      document.getElementById('saveScenarioDrawer').style.display = 'none';
      document.getElementById('activeScenarioLabel').textContent = 'None loaded';
      document.getElementById('overridesTextarea').value = '';
      runMappingGeneration();
    }

    function toggleLoadScenarioDrawer(forceState) {
      const drawer = document.getElementById('loadScenarioDrawer');
      const saveDrawer = document.getElementById('saveScenarioDrawer');
      saveDrawer.style.display = 'none';

      const nextOpen = forceState !== undefined ? forceState : drawer.style.display === 'none';
      drawer.style.display = nextOpen ? 'block' : 'none';
      if (nextOpen) {
        renderInterfaceScenariosList();
      }
    }

    function toggleSaveScenarioDrawer(forceState) {
      const drawer = document.getElementById('saveScenarioDrawer');
      const loadDrawer = document.getElementById('loadScenarioDrawer');
      loadDrawer.style.display = 'none';

      const nextOpen = forceState !== undefined ? forceState : drawer.style.display === 'none';
      drawer.style.display = nextOpen ? 'block' : 'none';
      if (nextOpen) {
        const iface = document.getElementById('interfaceSelect').value;
        const inp = document.getElementById('saveScenarioNameInput');
        if (!inp.value) {
          inp.value = iface.toLowerCase() + '-case.scenario.yaml';
        }
        inp.focus();
      }
    }

    function renderInterfaceScenariosList() {
      const iface = document.getElementById('interfaceSelect').value;
      const listEl = document.getElementById('interfaceScenariosList');
      listEl.innerHTML = '';

      if (!iface) {
        listEl.innerHTML = '<div style="font-size:11.5px; color:var(--text-faint); padding:4px 0;">Select a sender interface first, or browse a file below.</div>';
        return;
      }

      const matching = loadedScenarios.filter(item =>
        (item.scenario.interface || '').toLowerCase() === iface.toLowerCase()
      );

      if (matching.length === 0) {
        listEl.innerHTML = '<div style="font-size:11.5px; color:var(--text-faint); padding:4px 0;">No saved scenarios found for ' + iface + '.</div>';
        return;
      }

      matching.forEach(item => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-secondary btn-sm';
        btn.style.cssText = 'justify-content: space-between; width: 100%; text-align: left; font-weight: 400;';
        btn.innerHTML =
          '<span style="font-weight: 500; color: var(--text-primary);">' + item.scenario.name + '</span>' +
          '<span class="mono" style="font-size: 11px; color: var(--text-muted);">' + item.filename + '</span>';
        btn.onclick = () => {
          applyScenarioCase(item.scenario, item.filename);
          toggleLoadScenarioDrawer(false);
        };
        listEl.appendChild(btn);
      });
    }

    function applyScenarioCase(sc, labelName) {
      if (sc.interface) {
        document.getElementById('interfaceSelect').value = sc.interface;
        const searchEl = document.getElementById('interfaceSearchInput');
        if (searchEl) searchEl.value = sc.interface;
        updateSelectedInterfaceMeta(sc.interface);
      }
      document.getElementById('repeatCountInput').value = sc.count || 3;
      document.getElementById('allOptionalSelect').value = String(Boolean(sc.allOptional));
      document.getElementById('overridesTextarea').value = formatOverridesToTextarea(sc.overrides || {});
      document.getElementById('activeScenarioLabel').textContent = labelName || sc.name || 'Loaded scenario';
      setLayer(sc.layer || 3);
    }

    async function loadScenarioFromFile(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      // Simple YAML/JSON parser for scenario file
      try {
        let parsed = {};
        if (file.name.endsWith('.json')) {
          parsed = JSON.parse(text);
        } else {
          const overrides = {};
          let inOverrides = false;
          for (const rawLine of text.split(/\\r?\\n/)) {
            if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;
            if (rawLine.startsWith('overrides:')) {
              inOverrides = true;
              continue;
            }
            if (inOverrides && /^\\s+/.test(rawLine)) {
              const idx = rawLine.indexOf(':');
              if (idx !== -1) {
                const k = rawLine.slice(0, idx).trim();
                const v = rawLine.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
                overrides[k] = v;
              }
            } else {
              inOverrides = false;
              const idx = rawLine.indexOf(':');
              if (idx !== -1) {
                const k = rawLine.slice(0, idx).trim();
                const v = rawLine.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
                if (k === 'count' || k === 'layer') parsed[k] = Number(v);
                else if (k === 'allOptional') parsed[k] = v === 'true';
                else parsed[k] = v;
              }
            }
          }
          parsed.overrides = overrides;
        }
        applyScenarioCase(parsed, file.name);
        toggleLoadScenarioDrawer(false);
      } catch (e) {
        console.error(e);
      }
    }

    async function sanitizeCurrentOverrides() {
      const rawOverrides = parseOverridesTextarea();
      const res = await fetch('/api/scenarios/sanitize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: rawOverrides })
      });
      const data = await res.json();
      document.getElementById('overridesTextarea').value = formatOverridesToTextarea(data.sanitizedOverrides);
      runMappingGeneration();
    }

    async function saveCurrentScenario() {
      const interfaceName = document.getElementById('interfaceSelect').value;
      const count = Number(document.getElementById('repeatCountInput').value || 3);
      const allOptional = document.getElementById('allOptionalSelect').value === 'true';
      const overrides = parseOverridesTextarea();
      const rawName = (document.getElementById('saveScenarioNameInput').value || '').trim();
      const filename = rawName || (interfaceName.toLowerCase() + '.scenario.yaml');

      const res = await fetch('/api/scenarios/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          name: rawName.replace(/\\.scenario\\.ya?ml$/i, '') || (interfaceName + ' Scenario'),
          interface: interfaceName,
          layer: currentLayer,
          count,
          allOptional,
          overrides
        })
      });
      const data = await res.json();
      if (data.scenarios) {
        loadedScenarios = data.scenarios;
      }
      if (data.scenario) {
        document.getElementById('overridesTextarea').value = formatOverridesToTextarea(data.scenario.overrides || {});
        document.getElementById('activeScenarioLabel').textContent = filename;
      }
      toggleSaveScenarioDrawer(false);
    }

    async function runMappingGeneration() {
      const interfaceName = document.getElementById('interfaceSelect').value;
      if (!interfaceName) {
        resetMappingOutputPane();
        return;
      }
      const count = Number(document.getElementById('repeatCountInput').value || 3);
      const allOptional = document.getElementById('allOptionalSelect').value === 'true';
      const overrides = parseOverridesTextarea();

      const res = await fetch('/api/generate-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interfaceName,
          layer: currentLayer,
          count,
          allOptional,
          overrides,
          connectionMode: 'auto'
        })
      });
      const data = await res.json();
      if (data.error) return;

      lastGeneratedInterface = data.interfaceName;
      document.getElementById('genLayerBadge').textContent = 'Layer ' + data.activeLayer + ' Active';
      document.getElementById('esrMappingName').textContent = data.mappingRules?.mappingName || 'Layer 1 (Schema Only)';
      document.getElementById('esrTargetMessage').textContent = data.mappingRules?.targetMessageName || '—';
      document.getElementById('esrFieldStats').textContent =
        data.fieldStats.totalFields + ' leaf fields (' + (data.transitivelyMandatoryFields?.length || 0) + ' transitively mandatory)';

      const tbody = document.getElementById('targetCardinalitiesBody');
      tbody.innerHTML = '';
      (data.targetCardinalities || []).forEach(tc => {
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td class="mono">' + tc.targetPath + '</td>' +
          '<td><span class="badge ' + (tc.isMandatory ? 'badge-green' : 'badge-gray') + '">minOccurs=' + tc.minOccurs + '</span></td>' +
          '<td class="mono">' + (tc.mappedSourceFields || []).join(', ') + '</td>';
        tbody.appendChild(tr);
      });

      document.getElementById('xmlOutputPre').textContent = data.xmlPayload;
    }

    async function runFlatFileGeneration() {
      const spec = document.getElementById('fccSpecSelect').value;
      const count = Number(document.getElementById('fccCountInput').value || 3);
      const filename = document.getElementById('fccFilenameInput').value;
      const batchDate = document.getElementById('fccBatchDateInput').value;

      const res = await fetch('/api/generate-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec, count, filename, batchDate })
      });
      const data = await res.json();
      document.getElementById('fccFilenameLabel').textContent = data.filename;
      document.getElementById('fccFlatOutputPre').textContent = data.flatFileContent;
      document.getElementById('fccXmlOutputPre').textContent = data.postFccXml;

      const badge = document.getElementById('fccComplianceBadge');
      if (data.compliance && data.compliance.compliant) {
        badge.className = 'badge badge-green';
        badge.textContent = 'Compliant (' + data.lineCount + ' rows)';
      } else {
        badge.className = 'badge badge-red';
        badge.textContent = 'Non-Compliant';
      }
    }

    function proceedToExecutionWithPayload() {
      const xml = document.getElementById('xmlOutputPre').textContent;
      document.getElementById('parityPayloadA').value = xml;
      document.getElementById('parityPayloadB').value = xml;
      switchStep(3);
      runCanonicalDiff();
    }

    function loadParityPreset(key) {
      const p = parityPresetsCache[key];
      if (!p) return;
      document.getElementById('parityPayloadA').value = p.pipoXml;
      document.getElementById('parityPayloadB').value = p.cpiXml;
      runCanonicalDiff();
    }

    async function runCanonicalDiff() {
      const payloadA = document.getElementById('parityPayloadA').value;
      const payloadB = document.getElementById('parityPayloadB').value;
      const res = await fetch('/api/parity-diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payloadA, payloadB })
      });
      const diff = await res.json();
      const banner = document.getElementById('parityResultBanner');
      const tableWrap = document.getElementById('parityDiffTableWrap');
      const tbody = document.getElementById('parityDiffTableBody');

      if (diff.matched) {
        banner.style.background = 'var(--status-green-bg)';
        banner.style.border = '1px solid var(--status-green-border)';
        banner.style.color = 'var(--status-green-text)';
        banner.textContent = diff.summary;
        tableWrap.style.display = 'none';
      } else {
        banner.style.background = 'var(--status-red-bg)';
        banner.style.border = '1px solid var(--status-red-border)';
        banner.style.color = 'var(--status-red-text)';
        banner.textContent = diff.summary;
        tableWrap.style.display = 'block';
        tbody.innerHTML = '';
        (diff.differences || []).forEach(d => {
          const tr = document.createElement('tr');
          tr.innerHTML =
            '<td class="mono">' + d.path + '</td>' +
            '<td>' + d.reason + '</td>' +
            '<td class="mono">' + JSON.stringify(d.expected) + '</td>' +
            '<td class="mono">' + JSON.stringify(d.actual) + '</td>';
          tbody.appendChild(tr);
        });
      }
    }

    function copyText(elementId) {
      const text = document.getElementById(elementId).textContent;
      navigator.clipboard.writeText(text);
    }

    function downloadCurrentXml() {
      const xml = document.getElementById('xmlOutputPre').textContent;
      const blob = new Blob([xml], { type: 'application/xml' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = lastGeneratedInterface + '.mapping-test.xml';
      a.click();
    }

    async function initApp() {
      const res = await fetch('/api/status');
      const data = await res.json();

      // Populate hosts
      const hostSel = document.getElementById('hostSelect');
      hostSel.innerHTML = '';
      (data.hosts || []).forEach(h => {
        const opt = document.createElement('option');
        opt.value = h.id;
        opt.textContent = h.label;
        if (h.disabled) {
          opt.disabled = true;
        }
        hostSel.appendChild(opt);
      });

      // Populate indexed interfaces from environment snapshot
      availableInterfaces = data.interfaces || [];

      // Keep scenarios indexed in memory without pre-selecting a default
      loadedScenarios = data.scenarios || [];
      resetMappingOutputPane();

      parityPresetsCache = data.parityPresets || {};
      onChangeEnvironment();
      await runFlatFileGeneration();
      loadParityPreset('match');
    }

    window.addEventListener('DOMContentLoaded', initApp);
  </script>
</body>
</html>`;
}
