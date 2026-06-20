/**

 * =====================================================================================

 * API WRAPPER PARA GOOGLE SHEETS

 * =====================================================================================

 * @description

 * Esta clase abstrae toda la comunicación con la Web App de Google Apps Script.

 * Se encarga de construir las solicitudes (GET y POST) y de procesar las respuestas.
 */

class GoogleSheetsAPI {

  constructor() {

    /**

     * @description La URL de la Web App implementada en Google Apps Script.

     * !! IMPORTANTE: Reemplaza esta URL por la URL de tu propia implementación.

     */
    this.scriptURL = 'https://script.google.com/macros/s/AKfycbw3_fWKHQmX9g8MjQ1Qs32p_zHCQM5wnmkJIh6CJGLVBHvYEZ3MAgBtI0RkahAESv4/exec';
  }



  /**

   * @description Carga todos los datos del inventario desde la hoja de cálculo.

   * @returns {Promise<Array>} - Una promesa que se resuelve con un array de objetos del inventario.

   */

  async loadData() {

    console.log('📡 Cargando datos desde Google Sheets...');

    try {
      const response = await fetch(this.scriptURL);

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || `Error de red: ${response.statusText}`);
      }



      console.log(`✅ Datos cargados exitosamente: ${result.data.length} registros.`);

      return result.data;

    } catch (error) {

      console.error('❌ Error crítico al cargar desde Google Sheets:', error);
      return []; // Devuelve un array vacío como respaldo.
    }

  }



  /**

   * @description Envía una acción (add, update, delete) al script de Google mediante POST.

   * @param {string} action - La acción a realizar ('add', 'update', 'delete').
   * @param {Object} payload - Los datos adicionales para la acción.
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

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || `Error en la acción '${action}'`);
      }

      return result;
    } catch (error) {
      console.error(`❌ Fallo en la acción '${action}':`, error);
      return { success: false, error: error.message };
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
