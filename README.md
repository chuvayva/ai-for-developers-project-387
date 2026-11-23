# Календарь звонков (продолжение)

[![hexlet-check](https://github.com/chuvayva/ai-for-developers-project-387/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/chuvayva/ai-for-developers-project-387/actions)

Интегрируйте работу агентов в GitHub проект

Учебный проект Хекслета: https://ru.hexlet.io/programs/ai-for-developers
Как это должно работать: https://files.hexlet.app/a/2ipc5m

## Стек

- TypeScript and Vite
- UI is on Mantine
- API first with TypeSpec, OpenAPI specification

## Установка

Нужен [mise](https://mise.jdx.dev/). Он ставит Node и pnpm нужных версий из `mise.toml`.

```bash
git clone https://github.com/chuvayva/ai-for-developers-project-387.git
cd ai-for-developers-project-387
mise trust
mise install
mise run setup
mise run verify
```

`mise run setup` ставит зависимости и git-хуки. `mise run verify` запускает все проверки и затем браузерные тесты. Ту же команду запускает CI.

Её можно разбить на две части:

```bash
mise run check   # линтер, форматтер, генерация OpenAPI и SDK из TypeSpec, типы, тесты, сборка фронтенда
mise run e2e     # тесты Playwright в Chromium на свежем сервере и интерфейсе
```

`jactionlint` проверяет `.github/workflows/claude.yml` при коммите, перед push и в `mise run check` (в том числе в CI). Версия закреплена в `mise.toml`; правила корректности, безопасности и политик включены по умолчанию. Отдельный запуск:

```bash
mise exec -- jactionlint .github/workflows/claude.yml
```

## Использование

Одна команда запускает сервер и фронтенд вместе, `Ctrl+C` останавливает оба.

```bash
mise run dev      # API на http://127.0.0.1:3000 и интерфейс на http://localhost:5173
```

Их можно запустить и по отдельности.

```bash
mise run server   # только API
mise run web      # только интерфейс
```

Проверить, что сервер отвечает:

```bash
curl http://127.0.0.1:3000/api/health   # {"status":"ok"}
```

Контракт API описан в `api/main.tsp`. Команда `pnpm --filter @calendar/api build` собирает из него `api/generated/openapi.yaml`, типы TypeScript для сервера и клиентский SDK для фронтенда: по функции на каждую операцию контракта, с адресом запроса и типами. Фронтенд ходит в API только через этот SDK, поэтому изменение контракта, которое не дошло до интерфейса, ломает проверку типов.

## Docker

`Dockerfile` собирает один образ. В нём сервер отдаёт API под `/api` и собранный интерфейс на всех остальных путях, на одном порту из переменной `PORT`.

```bash
docker build -t calendar .
docker run --rm -e PORT=8080 -p 8080:8080 calendar   # http://localhost:8080
```

## Хранение данных

Типы событий и бронирования хранятся в памяти процесса, базы данных нет. Перезапуск удаляет все данные.

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.
