import os
import re
import zipfile
import shutil
import telebot

# Configura aquí el Token que te dio el BotFather de Telegram
TOKEN = '8679558881:AAHkM3p2L9WrOAQb8f56BOU8lksw4E-k024'
bot = telebot.TeleBot(TOKEN)

# Directorio temporal de trabajo
DATA_DIR = "workspace"

# Lista de procesos oficiales permitidos
PROCESOS_VALIDOS = [
    "TP", "TLA", "MEM", "MTTO", "ACTIVO", "PPYG", 
    "SALA DE OP", "SERVICIOS TECNICOS OPERACIONALES", "GERENTE"
]

def cargar_base_datos(ruta_txt):
    """Lee el archivo lista.txt y devuelve un diccionario indexado por cédula."""
    usuarios = {}
    if not os.path.exists(ruta_txt):
        return usuarios
        
    with open(ruta_txt, 'r', encoding='utf-8', errors='ignore') as f:
        # Omitir la cabecera (cedula,nombres,proceso)
        lineas = f.readlines()[1:]
        for linea in lineas:
            partes = linea.strip().split(',')
            if len(partes) >= 3:
                # .strip() elimina espacios fantasmas al inicio o final de cada campo
                cedula = partes[0].strip()
                nombre = partes[1].strip()
                proceso = partes[2].strip()
                
                if cedula:
                    usuarios[cedula] = {
                        "nombre": nombre,
                        "proceso": proceso
                    }
    return usuarios

@bot.message_handler(commands=['start', 'help'])
def enviar_bienvenida(message):
    bot.reply_to(message, "¡Hola! Envíame un archivo comprimido (.zip) que contenga los PDFs y yo me encargaré de renombrarlos y organizarlos por carpetas de proceso.")

@bot.message_handler(content_types=['document'])
def procesar_compreso(message):
    file_name = message.document.file_name
    
    # Validar que sea un archivo ZIP
    if not file_name.lower().endswith('.zip'):
        bot.reply_to(message, "Por favor, envía el archivo comprimido en formato **.zip**.")
        return
        
    status_msg = bot.reply_to(message, "⚡ Descargando y procesando archivo... Por favor espera.")
    
    # Crear rutas limpias para el chat actual
    chat_id = str(message.chat.id)
    chat_dir = os.path.join(DATA_DIR, chat_id)
    extract_dir = os.path.join(chat_dir, "extraido")
    output_dir = os.path.join(chat_dir, "organizado")
    
    # Limpiar cualquier residuo de ejecuciones anteriores
    if os.path.exists(chat_dir):
        shutil.rmtree(chat_dir)
    os.makedirs(extract_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)
    
    try:
        # 1. Descargar el archivo desde Telegram
        file_info = bot.get_file(message.document.file_id)
        downloaded_file = bot.download_file(file_info.file_path)
        zip_path = os.path.join(chat_dir, file_name)
        
        with open(zip_path, 'wb') as f:
            f.write(downloaded_file)
            
        # 2. Descomprimir el contenido
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
            
        # 3. Buscar si 'lista.txt' vino dentro del zip, o usar uno local en la raíz del bot
        ruta_lista = os.path.join(extract_dir, "lista.txt")
        if not os.path.exists(ruta_lista):
            ruta_lista = "lista.txt" # Intenta buscarlo en la carpeta donde corre el bot
            
        if not os.path.exists(ruta_lista):
            bot.edit_message_text("❌ Error: No encontré el archivo `lista.txt`. Asegúrate de que esté junto al bot o dentro del .zip.", chat_id, status_msg.message_id)
            return

        db_usuarios = cargar_base_datos(ruta_lista)
        
        # Crear las estructuras de carpetas oficiales + FORANEO
        for proc in PROCESOS_VALIDOS:
            os.makedirs(os.path.join(output_dir, proc), exist_ok=True)
        os.makedirs(os.path.join(output_dir, "FORANEO"), exist_ok=True)
        
        # 4. Recorrer los archivos extraídos y procesar PDFs
        for raiz, dirs, archivos in os.walk(extract_dir):
            for archivo in archivos:
                if archivo.lower().endswith('.pdf'):
                    ruta_original_pdf = os.path.join(raiz, archivo)
                    
                    # Expresión regular para extraer los números de la cédula al final del nombre
                    # Busca una cadena de dígitos justo antes de los espacios opcionales y el .pdf
                    match = re.search(r'(\d+)\s*\.pdf$', archivo, re.IGNORECASE)
                    
                    cedula_encontrada = None
                    if match:
                        cedula_encontrada = match.group(1).strip()
                    
                    # Verificar si la cédula existe en nuestro archivo de texto
                    if cedula_encontrada and cedula_encontrada in db_usuarios:
                        datos = db_usuarios[cedula_encontrada]
                        proceso_usuario = datos["proceso"]
                        nombre_usuario = datos["nombre"]
                        
                        # Definir nuevo nombre emulando tu lógica: PROCESO-CEDULA-NOMBRE.pdf
                        nuevo_nombre = f"{proceso_usuario}-{cedula_encontrada}-{nombre_usuario}.pdf"
                        
                        # Si el proceso está mapeado en las carpetas oficiales, va allí, sino a FORANEO
                        if proceso_usuario in PROCESOS_VALIDOS:
                            ruta_destino = os.path.join(output_dir, proceso_usuario, nuevo_nombre)
                        else:
                            ruta_destino = os.path.join(output_dir, "FORANEO", nuevo_nombre)
                    else:
                        # Si no hay cédula en el nombre o no existe en lista.txt va a FORANEO con su nombre original
                        ruta_destino = os.path.join(output_dir, "FORANEO", archivo)
                        
                    # Copiar/Mover el archivo a su nueva ubicación organizada
                    shutil.move(ruta_original_pdf, ruta_destino)
                    
        # 5. Volver a comprimir la estructura organizada para enviársela al usuario
        resultado_zip = os.path.join(chat_dir, f"ORGANIZADO_{file_name}")
        with zipfile.ZipFile(resultado_zip, 'w', zipfile.ZIP_DEFLATED) as zip_out:
            for raiz, dirs, archivos in os.walk(output_dir):
                for archivo in archivos:
                    ruta_completa = os.path.join(raiz, archivo)
                    # Mantener la estructura de carpetas interna relativa a output_dir
                    ruta_relativa = os.path.relpath(ruta_completa, output_dir)
                    zip_out.write(ruta_completa, ruta_relativa)
                    
        # 6. Enviar el archivo de vuelta al usuario por Telegram
        bot.edit_message_text("📦 ¡Todo listo! Subiendo el archivo organizado...", chat_id, status_msg.message_id)
        with open(resultado_zip, 'rb') as f:
            bot.send_document(chat_id, f, caption="Aquí tienes tus archivos renombrados y organizados por carpetas de proceso.")
            
    except Exception as e:
        bot.edit_message_text(f"❌ Ocurrió un error inesperado al procesar: {str(e)}", chat_id, status_msg.message_id)
        
    finally:
        # Limpieza de archivos temporales del servidor para no acumular espacio basura
        if os.path.exists(chat_dir):
            shutil.rmtree(chat_dir)

# Iniciar el bot en modo escucha continua
if __name__ == "__main__":
    print("Bot en marcha... Presiona Ctrl+C para detenerlo.")
    bot.infinity_polling()
