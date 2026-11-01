# tcp — The Chill Photographer

Визитка и фотоальбомы: Vite + React, публикация на GitHub Pages.

## Страницы

| Адрес | Что там |
|---|---|
| `/` | визитка: фото, имя, телефон, Albums, Telegram, Instagram, Save contact |
| `/albums/` | список альбомов |
| `/albums/<slug>/` | альбом |
| `/contact.vcf` | файл контакта, собирается при `npm run build` из `site.config.json` и `avatar-400.jpg` |

Фото профиля — `photos-src/avatar.jpg` (вне git); `npm run photos` делает из него `public/avatar-400.jpg` и `public/avatar-1200.jpg`.

## Структура

| Путь | Что это | В git |
|---|---|---|
| `photos-src/<slug>/` | исходные фото альбома | нет |
| `content/albums.json` | список альбомов: slug, название, дата, обложка, ссылка на архив | да |
| `site.config.json` | адрес сайта, подпись автора, ссылки на соцсети | да |
| `public/photos/<slug>/` | уменьшенные копии по длинной стороне (640 и 1600 px WebP, 2048 px JPEG, ~440 КБ на кадр) — результат `npm run photos` | да |
| `src/generated/albums.json` | манифест с размерами фото — результат `npm run photos` | да |

## Команды

```sh
npm run photos   # обработать фото из photos-src
npm run dev      # локальный сервер, http://localhost:5173
npm run build    # сборка в dist/ + отдельные HTML для превью ссылок
npm run preview  # просмотр собранной версии
```

## Новый альбом

1. Положить фото в `photos-src/<slug>/` (`slug` — латиница и дефисы, станет частью адреса).
2. Добавить запись в `content/albums.json`. Порядок записей — порядок карточек на главной. `title` выводится как есть, на любом языке; интерфейс сайта — на английском. `cover` — имя файла обложки; `null` — первое фото.
3. `npm run photos`, проверить в `npm run dev`.
4. Закоммитить `content/`, `public/photos/<slug>/`, `src/generated/` и запушить — GitHub Actions опубликует сайт.

«Скачать всё» собирает zip в браузере из JPEG 2048 px альбома — отдельный архив на хостинге не нужен.
`archiveUrl` — ссылка на zip с оригиналами (например, файл в GitHub Releases); при `null` кнопка «Оригиналы» не показывается.

Обработанные копии не удаляются при удалении исходника: лишние файлы в `public/photos/<slug>/` удаляются вручную.

## Публикация на GitHub Pages

- Адрес сайта задаётся одной строкой — `siteUrl` в `site.config.json`. Из его пути берётся `base` для Vite и роутера, из него же строятся абсолютные ссылки для превью в мессенджерах. Сейчас: `https://olkrind.github.io/tcp` (репозиторий `olkrind/tcp`). При переименовании репозитория или подключении своего домена меняется эта строка и адрес в `git remote set-url origin …`. Старые адреса `*.github.io/<прежнее имя>/` GitHub не перенаправляет — они отдают 404.
- Settings → Pages → Build and deployment → Source: **GitHub Actions**.
- Лимиты: сайт до 1 ГБ, файл до 100 МБ, трафик около 100 ГБ в месяц.
