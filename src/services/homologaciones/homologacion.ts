
export async function homologacionAprobada() {
  let endpoint = 'https://apphomologaciones-stg.cunapp.pro/api/v1/homologaciones?estatus=Aprobado';
  
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Error al obtener homologaciones aprobadas:', error);
    throw error;
  }
}