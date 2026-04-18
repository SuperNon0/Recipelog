import 'dotenv/config'
import { db } from './index.js'
import { categories, pdfTemplates, settings } from './schema.js'

// Catégories par défaut
await db.insert(categories).values([
  { name: 'Entremets',     color: '#e8c547' },
  { name: 'Biscuits',      color: '#4fc3a1' },
  { name: 'Viennoiseries', color: '#e87c47' },
  { name: 'Pâtes de base', color: '#a78bfa' },
  { name: 'Crèmes',        color: '#e85c47' },
  { name: 'Glaçages',      color: '#4fc3a1' },
  { name: 'Confiserie',    color: '#e8c547' },
  { name: 'Glacées',       color: '#a78bfa' }
]).onConflictDoNothing()

// Templates PDF
await db.insert(pdfTemplates).values([
  { name: 'Classique',       slug: 'classique',      description: 'Mise en page éditoriale classique, sobre et lisible' },
  { name: 'Moderne',         slug: 'moderne',        description: 'Style minimaliste moderne, beaucoup d'espace' },
  { name: 'Fiche technique', slug: 'fiche-technique', description: 'Dense et structuré, adapté à l'usage professionnel' },
  { name: 'Magazine',        slug: 'magazine',       description: 'Photo pleine page, mise en page magazine' }
]).onConflictDoNothing()

// Paramètres par défaut
await db.insert(settings).values([
  { key: 'ingredient_mode', value: 'A' },
  { key: 'logo_enabled',    value: 'false' },
  { key: 'logo_path',       value: '' }
]).onConflictDoNothing()

console.log('Seed exécuté avec succès')
process.exit(0)
