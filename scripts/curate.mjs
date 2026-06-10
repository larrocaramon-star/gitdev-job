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
