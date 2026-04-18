import puppeteer from 'puppeteer'
import { readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATES_DIR = join(__dirname, '../../../templates')

/**
 * Génère un PDF depuis un template HTML + données
 * @param {string} templateSlug - classique | moderne | fiche-technique | magazine
 * @param {object} data - données à injecter dans le template
 * @param {string} format - A4 | A5
 * @returns {Buffer} - buffer PDF
 */
export async function generatePDF(templateSlug, data, format = 'A4') {
  const templatePath = join(TEMPLATES_DIR, templateSlug, 'index.html')
  let html = await readFile(templatePath, 'utf8')

  // Remplacement simple des variables {{key}}
  html = html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key]
    return val !== undefined ? String(val) : ''
  })

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })

    const pdfBuffer = await page.pdf({
      format,
      printBackground: true,
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' }
    })

    return pdfBuffer
  } finally {
    await browser.close()
  }
}

/**
 * Génère un PDF pour une recette unique
 */
export async function generateRecipePDF(recipe, templateSlug = 'classique', format = 'A4') {
  const totalMass = recipe.ingredients?.reduce((sum, i) => sum + (i.quantityG || 0), 0) ?? 0

  const ingredientsHtml = recipe.ingredients?.map(i =>
    `<tr><td class="qty">${i.quantityG}g</td><td>${i.name}</td></tr>`
  ).join('') ?? ''

  const data = {
    nom: recipe.name,
    source: recipe.source || '',
    notes: recipe.notes || '',
    masse_totale: totalMass,
    ingredients: ingredientsHtml,
    etapes: (recipe.stepsContent || '').replace(/\n/g, '<br>'),
    tags: (recipe.tags || []).join(', '),
    date: new Date().toLocaleDateString('fr-FR')
  }

  return generatePDF(templateSlug, data, format)
}

/**
 * Génère un PDF pour un cahier complet
 */
export async function generateCookbookPDF(cookbook, recipesData, format = 'A4') {
  const templateSlug = cookbook.template?.slug ?? 'classique'

  let allPagesHtml = ''

  // Page de garde
  if (cookbook.hasCover) {
    allPagesHtml += `
      <div class="page cover-page">
        <h1>${cookbook.name}</h1>
        ${cookbook.description ? `<p class="description">${cookbook.description}</p>` : ''}
        <p class="date">${new Date().toLocaleDateString('fr-FR')}</p>
      </div>
    `
  }

  // Sommaire
  if (cookbook.hasToc) {
    const tocItems = recipesData.map((r, i) =>
      `<li><span class="toc-num">${i + 1}</span><span class="toc-name">${r.name}</span></li>`
    ).join('')
    allPagesHtml += `<div class="page toc-page"><h2>Sommaire</h2><ol>${tocItems}</ol></div>`
  }

  // Fiches recettes
  for (const recipe of recipesData) {
    const totalMass = recipe.ingredients?.reduce((sum, i) => sum + (i.quantityG || 0), 0) ?? 0
    const ingredientsHtml = recipe.ingredients?.map(i =>
      `<tr><td class="qty">${i.quantityG}g</td><td>${i.name}</td></tr>`
    ).join('') ?? ''

    allPagesHtml += `
      <div class="page recipe-page">
        <h2>${recipe.name}</h2>
        <div class="masse-totale">Masse totale : ${totalMass}g</div>
        <table class="ingredients">${ingredientsHtml}</table>
        <div class="etapes">${(recipe.stepsContent || '').replace(/\n/g, '<br>')}</div>
        ${recipe.notes ? `<div class="notes"><strong>Notes :</strong> ${recipe.notes}</div>` : ''}
      </div>
    `
  }

  const templateCssPath = join(TEMPLATES_DIR, templateSlug, 'style.css')
  let css = ''
  try { css = await readFile(templateCssPath, 'utf8') } catch {}

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Mono', monospace; font-size: 11pt; color: #111; }
        .page { page-break-after: always; padding: 10mm; }
        ${css}
      </style>
    </head>
    <body>${allPagesHtml}</body>
    </html>
  `

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    return await page.pdf({ format, printBackground: true })
  } finally {
    await browser.close()
  }
}
