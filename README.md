# Web Presentation
対面/音声通話時を想定したWebプレゼンです。  
スクリーン・プロジェクターやモニターがない時に使えます。  
Zoomなどよりは軽量で動作が早いはずです。

## Required:
- Nginx
- Certbot
- PM2
- Node.js (22.0.0↑)
- NPM

## Main
### Frontend
- Svelte
### Backend
- Express
- Socket.IO

```bash
git clone THIS_PROJECT
cd PROJECT_FOLDER
cd frontend
npm install
npm run build
cd ../backend
npm install
pm2 start server.js
nano /etc/nginx/sites-available/XXXXXX
sudo ln -s /etc/nginx/sites-available/XXXXXX /etc/nginx/sites-enabled/
sudo certbot --nginx -d XXXXXX
nginx -t
systemctl reload nginx
```

## Nginx config
```
/etc/nginx/sites-available/XXXXXX
```
```nginx
server {
    server_name XXXXXX;

    # ファイルアップロード制約
    client_max_body_size 50M;

    # フロントエンド
    location / {
        root /XXXXXX/frontend/build;
        try_files $uri $uri/ /index.html;
    }

    # バックエンド
    location /public/ {
        alias /XXXXXX/backend/public/;
        expires 7d;
    }

    # API
    location /upload {
        proxy_pass http://127.0.0.1:PORT;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Socket.IO
    location /socket.io/ {
        proxy_pass http://127.0.0.1:PORT/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/XXXXXX/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/XXXXXX/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

}
server {
    if ($host = XXXXXX) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    server_name XXXXXX;

    listen 80;
    return 404; # managed by Certbot


}
```
