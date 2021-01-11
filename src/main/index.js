'use strict'

import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron'
import fs from 'fs'

app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors')

app.disableHardwareAcceleration()
app.disableDomainBlockingFor3DAPIs()

// if (process.env.NODE_ENV !== 'development') {
  // import i2c from 'i2c-bus'
// }

/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== 'development') {
  global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

let mainWindow
const winURL = process.env.NODE_ENV === 'development'
  ? `http://localhost:9080`
  : `file://${__dirname}/index.html`

let i2c1 = null
const ADDR = 0x8
const CMD_OFF = 101
const CMD_ON_MATRIX = 102
const CMD_ON_ALL = 103

async function initialStep () {
  await createWindow()
  await initListener()

  if (process.env.NODE_ENV !== 'development') {
    i2c1 = i2c.openSync(1)
  }
}

let config = {}
const configPath = `${app.getPath('home')}/automation.config`

async function getConfigFromFile () {
  const exist = fs.existsSync(configPath)
  if (exist) {
    const configBuffer = fs.readFileSync(configPath)
    if (configBuffer && configBuffer.length) {
      config = JSON.parse(configBuffer)
      if (config['assigner-fixed-core']) {
        config = config['assigner-fixed-core']
      }
    }
  }
}

getConfigFromFile()

async function createWindow () {
  return new Promise((resolve, reject) => {
    /**
     * Initial window options
     */
    if (process.env.NODE_ENV === 'development') {
      if (config['view'] === 'soft-picking') {
        mainWindow = new BrowserWindow({
          height: 1080,
          width: 1920,
          // useContentSize: true
          webPreferences: {
            webSecurity: false,
            nodeIntegration: true
          }
        })
      } else {
        mainWindow = new BrowserWindow({
          height: 1080,
          width: 608,
          // useContentSize: true
          webPreferences: {
            webSecurity: false,
            nodeIntegration: true
          }
        })
      }

      // mainWindow.setFullScreen(true)
    } else {
      mainWindow = new BrowserWindow({
        webPreferences: {
          webSecurity: false,
          nodeIntegration: true
        }
      })

      mainWindow.setFullScreen(true)
    }

    mainWindow.loadURL(winURL)

    mainWindow.on('closed', async () => {
      mainWindow = null
    })

    globalShortcut.register('F12', () => {
      mainWindow.webContents.openDevTools()
    })

    globalShortcut.register('Ctrl+Shift+I', () => {
      mainWindow.webContents.openDevTools()
    })

    return resolve()
  })
}

async function initListener () {
  // const CMD_OFF = 101
  // const CMD_ON_MATRIX = 102
  // const CMD_ON_ALL = 103

  ipcMain.on('sendToArduinoOff', () => {
    if (i2c1) {
      try {
        i2c1.writeI2cBlockSync(ADDR, CMD_OFF, 1, Buffer.from([ 0x00 ]))
      } catch (err) {
        console.log(err)
      }
    }
  })

  ipcMain.on('sendToArduinoMatrix', (event, { pins, index, color }) => {
    if (i2c1) {
      const bytes = []
      switch (color) {
        case 'red':
          bytes.push(1)
          break
        case 'green':
          bytes.push(2)
          break
        case 'blue':
          bytes.push(3)
          break
        case 'orange':
          bytes.push(4)
          break
      }

      bytes.push(pins.length * 2)

      for (let i = 0; i < pins.length; i++) {
        bytes.push(pins[i])
        bytes.push(index)
      }

      try {
        i2c1.writeI2cBlockSync(ADDR, CMD_ON_MATRIX, bytes.length + 1, Buffer.from([ ...bytes, 0x00 ]))
      } catch (err) {
        console.log(err)
      }
    }
  })

  ipcMain.on('sendToArduinoAll', (event, { color }) => {
    if (i2c1) {
      const bytes = []
      switch (color) {
        case 'red':
          bytes.push(1)
          break
        case 'green':
          bytes.push(2)
          break
        case 'blue':
          bytes.push(3)
          break
        case 'orange':
          bytes.push(4)
          break
      }

      try {
        i2c1.writeI2cBlockSync(ADDR, CMD_ON_ALL, bytes.length + 1, Buffer.from([ ...bytes, 0x00 ]))
      } catch (err) {
        console.log(err)
      }
    }
  })

  ipcMain.on('get-config', (event, { key, value }) => {
    // console.log(key, config[key], value)
    mainWindow.webContents.send('get-config-result', {
      key,
      value: config[key] || value
    })
  })
}

app.on('ready', initialStep)

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', async () => {
  if (mainWindow === null) {
    await initialStep()
  }
})
