const { app, BrowserWindow } = require('electron');
const path = require('node:path');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1200,
    height: 760,
    show: false,
    webPreferences: { preload: path.join(__dirname, 'layout-test-preload.cjs'), contextIsolation: true, sandbox: false }
  });
  await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  await new Promise((resolve) => setTimeout(resolve, 250));
  const result = await window.webContents.executeJavaScript(`(async () => {
    [...document.querySelectorAll('nav button')].find((button) => button.textContent.includes('Console')).click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const output = document.querySelector('.console-output');
    for (let index = 0; index < 250; index += 1) {
      const row = document.createElement('div');
      row.innerHTML = '<time>12:00:00</time><pre>synthetic console history row ' + index + '</pre><button></button>';
      output.appendChild(row);
    }
    const sidebar = document.querySelector('.sidebar').getBoundingClientRect();
    const topbar = document.querySelector('.topbar').getBoundingClientRect();
    const beforeDocumentScroll = document.documentElement.scrollTop;
    output.scrollTop = 800;
    return {
      viewportHeight: innerHeight,
      documentHeight: document.documentElement.scrollHeight,
      documentScrollChanged: document.documentElement.scrollTop !== beforeDocumentScroll,
      sidebarTop: sidebar.top,
      sidebarBottom: sidebar.bottom,
      topbarTop: topbar.top,
      consoleScrollable: output.scrollHeight > output.clientHeight,
      consoleScrollTop: output.scrollTop
    };
  })()`);
  const passed = result.documentHeight === result.viewportHeight && !result.documentScrollChanged && result.sidebarTop === 0 && result.sidebarBottom === result.viewportHeight && result.topbarTop === 0 && result.consoleScrollable && result.consoleScrollTop > 0;
  console.log(JSON.stringify({ passed, ...result }, null, 2));
  window.destroy();
  app.exit(passed ? 0 : 1);
}).catch((error) => { console.error(error); app.exit(1); });
