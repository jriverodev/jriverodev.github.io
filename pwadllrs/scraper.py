import requests
from bs4 import BeautifulSoup
import datetime

def get_bcv_rate():
    url = "https://bcv.org.ve"
    # El BCV a veces bloquea peticiones sin User-Agent
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    response = requests.get(url, headers=headers, verify=False)
    soup = BeautifulSoup(response.content, 'html.parser')
    
    # Buscamos el contenedor del dólar
    dolar_tag = soup.find(id="dolar")
    rate = dolar_tag.find('strong').text.strip()
    return rate

def create_pwa(rate):
    now = datetime.datetime.now().strftime("%d/%m/%Y %I:%M %p")
    html_content = f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dólar BCV Hoy</title>
        <link rel="manifest" href="manifest.json">
        <style>
            body {{ font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f2f5; }}
            .card {{ background: white; padding: 2rem; border-radius: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }}
            h1 {{ color: #1a73e8; margin-bottom: 0.5rem; }}
            .price {{ font-size: 3rem; font-weight: bold; color: #333; }}
            .date {{ color: #666; font-size: 0.9rem; margin-top: 1rem; }}
        </style>
    </head>
    <body>
        <div class="card">
            <h1>Dólar BCV</h1>
            <div class="price">Bs. {rate}</div>
            <div class="date">Actualizado: {now}</div>
        </div>
        <script>
            if ('serviceWorker' in navigator) {{
                navigator.serviceWorker.register('sw.js');
            }}
        </script>
    </body>
    </html>
    """
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html_content)

rate = get_bcv_rate()
create_pwa(rate)
