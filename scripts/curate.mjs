import fs from 'fs';
import path from 'path';

// Decimos dónde se va a guardar la información final en nuestra carpeta
const DATA_FILE = path.join(process.cwd(), 'public', 'data', 'jobs.json');

// Palabras clave: El trabajo DEBE tener alguna de estas palabras para ser aceptado
const KEYWORDS = ['react', 'node', 'python', 'webflow', 'shopify', 'frontend', 'backend', 'fullstack', 'api', 'wordpress'];

// Palabras prohibidas: Si dice esto, el trabajo se descarta automáticamente (así evitamos agencias)
const BAN_WORDS = ['agency', 'long term', 'recruiter', 'consultancy'];

// --- FUENTE 1: WE WORK REMOTELY ---
async function buscarEnWeWorkRemotely() {
  try {
    console.log('Buscando en We Work Remotely...');
    const response = await fetch('https://weworkremotely.com/api/v1/posts');
    if (!response.ok) return [];
    
    const data = await response.json();
    
    // Convertimos el formato de ellos al formato limpio que usa nuestra web
    return data.jobs.map(job => ({
      id: `wwr-${job.id}`,
      title: job.title,
      company: job.company,
      url: job.url,
      source: 'We Work Remotely',
      // Borramos códigos raros de internet (<p>, <div>) y acortamos el texto para que no sea larguísimo
      description: job.description.replace(/<[^>]*>/g, '').substring(0, 250) + '...',
      date_fetched: new Date().toISOString()
    }));
  } catch (error) {
    console.log('Error en We Work Remotely, saltando fuente...', error.message);
    return [];
  }
}

// --- FUENTE 2: HACKER NEWS ---
async function buscarEnHackerNews() {
  try {
    console.log('Buscando en Hacker News...');
    const res = await fetch('https://hacker-news.firebaseio.com/v0/jobstories.json');
    if (!res.ok) return [];
    const ids = await res.json();
    
    // Agarramos solo los 10 más recientes para que la tablet y el robot no se cansen
    const ultimosIds = ids.slice(0, 10);
    
    const trabajos = await Promise.all(ultimosIds.map(async (id) => {
      const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
      return itemRes.json();
    }));

    return trabajos.map(job => ({
      id: `hn-${job.id}`,
      title: job.title,
      company: 'Compañía de HN',
      url: job.url || `https://news.ycombinator.com/item?id=${job.id}`,
      source: 'Hacker News',
      description: 'Oferta directa de trabajo publicada por la comunidad de Hacker News.',
      date_fetched: new Date().toISOString()
    }));
  } catch (error) {
    console.log('Error en Hacker News, saltando fuente...', error.message);
    return [];
  }
}

// --- EL FILTRO INTELIGENTE ---
function filtrarTrabajos(listaDeTrabajos) {
  return listaDeTrabajos.filter(job => {
    const textoCompleto = (job.title + ' ' + job.description).toLowerCase();
    
    // 1. ¿Tiene alguna de nuestras tecnologías? (Sí/No)
    const tieneTecnologia = KEYWORDS.some(palabra => textoCompleto.includes(palabra));
    // 2. ¿Es de una agencia molesta? (Sí/No)
    const noEsAgencia = !BAN_WORDS.some(palabra => textoCompleto.includes(palabra));
    
    // Si tiene la tecnología y NO es agencia, se queda en nuestra web
    return tieneTecnologia && noEsAgencia;
  });
}

// --- FUNCIÓN PRINCIPAL QUE JUNTA TODO ---
async function iniciarProceso() {
  // 1. Descargar datos de internet al mismo tiempo
  const [trabajosWWR, trabajosHN] = await Promise.all([
    buscarEnWeWorkRemotely(),
    buscarEnHackerNews()
  ]);

  // 2. Juntar todo en una sola lista gigante y filtrarla
  const todosLosTrabajos = [...trabajosWWR, ...trabajosHN];
  const filtrados = filtrarTrabajos(todosLosTrabajos);

  // 3. Revisar si ya teníamos trabajos guardados de antes en el archivo JSON
  let trabajosViejos = [];
  if (fs.existsSync(DATA_FILE)) {
    try {
      trabajosViejos = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    } catch (e) {
      trabajosViejos = [];
    }
  }

  // 4. Fusionar lo nuevo con lo viejo sin repetir nada (usamos el ID único de cada trabajo)
  const mapaDeTrabajos = new Map();
  trabajosViejos.forEach(trabajo => mapaDeTrabajos.set(trabajo.id, trabajo));
  filtrados.forEach(trabajo => mapaDeTrabajos.set(trabajo.id, trabajo));

  // 5. Borrar los trabajos que tengan más de 7 días (para que la web esté siempre actualizada)
  const limiteDias = new Date();
  limiteDias.setDate(limiteDias.getDate() - 7);

  const listaFinal = Array.from(mapaDeTrabajos.values())
    .filter(trabajo => new Date(trabajo.date_fetched) > limiteDias)
    .slice(0, 50); // Nos quedamos solo con los mejores 50

  // 6. Escribir el archivo definitivo en la memoria del proyecto
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(listaFinal, null, 2));
  console.log(`¡Éxito! Guardados ${listaFinal.length} trabajos filtrados.`);
}

iniciarProceso();
