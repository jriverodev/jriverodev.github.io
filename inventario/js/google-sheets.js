/**

 * =====================================================================================

 * API WRAPPER PARA GOOGLE SHEETS

 * =====================================================================================

 * @description

 * Esta clase abstrae toda la comunicación con la Web App de Google Apps Script.

 * Se encarga de construir las solicitudes (GET y POST) y de procesar las respuestas.

 * Es fundamental que la `scriptURL` sea correcta.

 */

class GoogleSheetsAPI {

  constructor() {

    /**

     * @description La URL de la Web App implementada en Google Apps Script.

     * !! IMPORTANTE: Reemplaza esta URL por la URL de tu propia implementación.

     */

    this.scriptURL = 'https://script.google.com/macros/s/AKfycbzFLj0CZEy3U0burUh2lhz_-y4uVOB4cxWGtF7dH5cjaQ6pIo7tCud2PVehDvlX-CoJ/exec';

  }



  /**

   * @description Carga todos los datos del inventario desde la hoja de cálculo.

   * @returns {Promise<Array>} - Una promesa que se resuelve con un array de objetos del inventario.

   */

  async loadData() {

    console.log('📡 Cargando datos desde Google Sheets...');

    try {

      // Realiza una solicitud GET simple para obtener todos los datos.

      const response = await fetch(this.scriptURL);

      const result = await response.json();



      if (!response.ok) {

        // Si la respuesta HTTP no es exitosa (ej. 500 Internal Server Error).

        throw new Error(`Error de red: ${response.statusText}`);

      }

      if (!result.success) {

        // Si la respuesta del script indica un fallo.

        throw new Error(`Error en el script de Google: ${result.error}`);

      }



      console.log(`✅ Datos cargados exitosamente: ${result.data.length} registros.`);

      return result.data;

    } catch (error) {

      console.error('❌ Error crítico al cargar desde Google Sheets:', error);

      // Devuelve un array vacío como respaldo para que la aplicación no se rompa.

      return [];

    }

  }



  /**

   * @description Envía una acción (add, update, delete) al script de Google mediante POST.

   * @param {string} action - La acción a realizar ('add', 'update', 'delete').

   * @param {Object} payload - Los datos adicionales para la acción (newItem, itemId, updates).

   * @returns {Promise<Object>} - Una promesa que se resuelve con la respuesta del servidor.

   */

  async sendAction(action, payload) {

    try {


      const response = await fetch(this.scriptURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, ...payload }),
        redirect: 'follow', // Google Apps Script a menudo redirige, esto lo maneja.
      });

      if (!response.ok) {
        throw new Error(`Error de red: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
          throw new Error(`Error en el script de Google: ${result.error}`);
      }

      return result;










    } catch (error) {


      // Esto solo capturará errores de red, no errores lógicos del script.

      console.error(`❌ Fallo en la acción '${action}':`, error);


      return { success: false, error: `Error de red: ${error.message}` };


    }

  }



  /**

   * @description Envía una solicitud para agregar un nuevo item al inventario.

   * @param {Object} newItem - El objeto que representa el nuevo item.

   * @returns {Promise<Object>} - La respuesta del servidor.

   */

  addInventoryItem(newItem) {

    return this.sendAction('add', { newItem });

  }



  /**

   * @description Envía una solicitud para actualizar un item existente.

   * @param {string|number} itemId - El ID del item a actualizar.

   * @param {Object} updates - Un objeto con los campos a actualizar.

   * @returns {Promise<Object>} - La respuesta del servidor.

   */

  updateInventoryItem(itemId, updates) {

    return this.sendAction('update', { itemId, updates });

  }



  /**

   * @description Envía una solicitud para eliminar un item del inventario.

   * @param {string|number} itemId - El ID del item a eliminar.

   * @returns {Promise<Object>} - La respuesta del servidor.

   */

  deleteInventoryItem(itemId) {

    return this.sendAction('delete', { itemId });

  }

}
