#!/usr/bin/env node
import inquirer from 'inquirer'
import { readFile, writeFile, unlink, mkdir, readdir } from 'fs/promises'
import { access, constants, existsSync } from 'fs'
import { pathToFileURL } from 'url'
import chalk from 'chalk'

const questions = [
  {
    name: 'rootPath',
    type: 'input',
    message: 'Project root path'
  },
  {
    name: 'childThemePath',
    type: 'input',
    message: 'Child theme path'
  }
]
const { rootPath, childThemePath } = await inquirer.prompt(questions)
const alpacaThemePath = `${rootPath}/vendor/snowdog/theme-frontend-alpaca`
const customVariablesFilePath = '/Snowdog_Components/components/Atoms/variables'
let customVariablesFile = await readdir(`${childThemePath}${customVariablesFilePath}`)
customVariablesFile = customVariablesFile
  .toString()
  .replace('_', '')
  .replace('.scss', '')
const todoComment = '// TODO: check for missing custom styles and remove unused styles if needed'

async function updateComponentStyles () {
  const atomicDirectories = [
    'Atoms',
    'Molecules',
    'Organisms',
    'Templates'
  ]
  const oldFiles = []
  atomicDirectories.map((dir, index) => (oldFiles[index] = `${childThemePath}/Snowdog_Components/components/${dir}/_components.scss`))
  const newDirectory = 'Snowdog_Components/components/styles'
  const extendedStyles = []
  const regex = /@import '([\w_/]*)-extend'/g
  const filePathIndex = ('@import \'').length

  for (const [index, file] of oldFiles.entries()) {
    access(
      file,
      constants.F_OK,
      async (err) => {
        if (!err) {
          try {
            const content = await readFile(pathToFileURL(file), 'utf-8')
            const directoryExtendedStyles = content.match(regex)

            for (const str of directoryExtendedStyles) {
              extendedStyles.push(
                [str.slice(0, filePathIndex), `../${atomicDirectories[index]}/`, str.slice(filePathIndex)]
                  .join('')
                  .replace('-extend\'', '')
              )
            }
            await unlink(file)
            console.log(chalk.green(`- Removed ${childThemePath}/${file}`))
          } catch (err) {
            console.error(chalk.red(err))
            process.exit(1)
          }
        }
      }
    )
  }

  const newFiles = [
    '_critical.scss',
    '_non-critical.scss',
    '_checkout.scss',
    '_critical-checkout.scss'
  ]
  newFiles.forEach((file, index) => (newFiles[index] = `${newDirectory}/${file}`))
  const newDirectoryFullPath = `${childThemePath}/${newDirectory}`

  if (!existsSync(newDirectoryFullPath)) {
    await mkdir(newDirectoryFullPath)
  };

  for (const file of newFiles) {
    try {
      let content = await readFile(pathToFileURL(`${alpacaThemePath}/${file}`), 'utf-8')
      extendedStyles.forEach(style => {
        content = content.replace(style, `${style}-extend`)
      })

      if (content.includes('extend')) {
        content = content.replaceAll('-extend\'', '-extend\' // Extend')
        await writeFile(`${childThemePath}/${file}`, `${todoComment}\n\n${content}`)
        console.log(chalk.green(`+ Added ${childThemePath}/${file}`))
      }
    } catch (err) {
      console.error(chalk.red(err))
      console.log(chalk.blue('Make sure you updated theme alpaca to >= 2.26.0.'))
      process.exit(1)
    }
  }
}

async function updateComponentsBuildStyles () {
  const files = [
    'checkout.scss',
    'styles.scss'
  ]
  const filesDirectory = 'Snowdog_Components/docs/styles'
  const alpacaFiles = files.map(file => `${alpacaThemePath}/${filesDirectory}/${file}`)
  const childFiles = files.map(file => `${childThemePath}/${filesDirectory}/${file}`)

  for (const [index] of files.entries()) {
    try {
      const customVariablesImport = `@import '../../components/Atoms/variables/${customVariablesFile}';`
      let content = await readFile(pathToFileURL(alpacaFiles[index]), 'utf-8')
      content = content.replace('// Variables', `// Variables\n${customVariablesImport}`)

      await writeFile(childFiles[index], content)
      console.log(chalk.green(`+ Updated ${childFiles[index]}`))
    } catch (err) {
      console.error(chalk.red(err))
    }
  }
}

async function updateStyles () {
  const oldFiles = [
    '_theme.scss',
    'styles.scss'
  ]
  oldFiles.forEach((file, index) => (oldFiles[index] = `${childThemePath}/styles/${file}`))

  for (const file of oldFiles) {
    if (existsSync(file)) {
      try {
        await unlink(file)
        console.log(chalk.green(`- Removed ${file}`))
      } catch (err) {
        console.error(chalk.red(err))
      }
    }
  }

  const newFiles = [
    'critical-checkout.scss',
    'critical.scss',
    'styles.scss'
  ]
  const customVariablesImport = `@import '..${customVariablesFilePath}/${customVariablesFile}';`

  for (const file of newFiles) {
    try {
      let content = await readFile(pathToFileURL(`${alpacaThemePath}/styles/${file}`), 'utf-8')
      content = content.replace('// Variables', `${todoComment}\n\n// Variables\n${customVariablesImport}`)

      await writeFile(`${childThemePath}/styles/${file}`, content)
      console.log(chalk.green(`+ Added ${childThemePath}/styles/${file}`))
    } catch (err) {
      console.error(chalk.red(err))
      process.exit(1)
    }
  }
}

await updateComponentStyles()
await updateComponentsBuildStyles()
await updateStyles()
console.log(chalk.magenta.bold('Check your theme to see the results 🤞 New files should include a TODO that requires your action.'))
