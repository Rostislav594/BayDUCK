# Заявка на доступ к OLX Partner API — черновик

Статус: черновик от 2026-10-21, не отправлен.
Связанные требования: раздел «Интеграция с OLX» в [PROJECT.md](../PROJECT.md).

## Перед отправкой

- **Подаёт клиент** (или вы от его имени, с его согласия) с реальными данными бизнеса. OLX отклоняет заявки «для пробы» и с неточными данными.
- Где подавать: регистрация партнёра на портале разработчиков OLX Украины (developer.olx.ua). Точный набор полей формы проверить на месте — ниже собраны тексты под типичные поля.
- **Не отправлять, пока нет ответа на пункты ниже.** Особенно важны сайт и redirect URL: с прототипом на GitHub Pages и демо-плашкой заявку, скорее всего, отклонят.

### Что нужно получить у клиента

| Поле | Значение |
|---|---|
| Юридическое лицо / ФОП | `[название, ЄДРПОУ / РНОКПП]` |
| Контактное лицо | `[имя, фамилия, должность]` |
| Email | `[рабочий email]` |
| Телефон | `[рабочий телефон, +380…]` |
| Аккаунт OLX | `[email или ссылка на профиль продавца]` |
| Примерное число активных объявлений | `[N]` |
| Сайт магазина | `[домен BuyDUCK — когда появится]` |
| Redirect URL для OAuth | `[https://<домен>/olx/callback — после выбора хостинга]` |

## Текст заявки (українською)

**Назва застосунку:** BuyDUCK OLX Sync

**Короткий опис:**
BuyDUCK — інтернет-магазин взуття, одягу та аксесуарів `[назва ФОП / компанії]`, який уже продає товари на OLX. Ми розробляємо власну систему обліку товарів (CRM) для магазину BuyDUCK і хочемо синхронізувати її з нашим акаунтом продавця на OLX.

**Як буде використовуватися API:**
- імпорт наших активних оголошень з OLX до каталогу BuyDUCK, щоб не дублювати введення товарів вручну;
- створення нових оголошень на OLX із системи BuyDUCK (назва, опис, ціна в UAH, фото, категорія та обов'язкові атрибути — розмір, бренд, стан);
- оновлення ціни, опису та фото, деактивація проданих товарів і повторна активація;
- робота лише з оголошеннями власного акаунта, який авторизує застосунок через OAuth. Дані інших продавців і ринку не збираємо та не використовуємо.

**Користувачі застосунку:** лише працівники магазину BuyDUCK `[кількість]`. Застосунок не надається третім особам.

**Обсяг:** близько `[N]` активних оголошень, `[N]` нових на тиждень.

**Безпека:** секрет застосунку й токени зберігаються лише на сервері; доступ до панелі керування — тільки для авторизованих працівників магазину.

**Контакти:** `[ім'я]`, `[email]`, `[телефон]`, сайт: `[домен]`.

## Application text (English, if the form is in English)

**Application name:** BuyDUCK OLX Sync

**Description:**
BuyDUCK is an online store for footwear, clothing and accessories run by `[company / sole proprietor]`, which already sells on OLX Ukraine. We are building our own inventory management system (CRM) for the BuyDUCK store and want to synchronise it with our OLX seller account.

**Intended API use:**
- import our own active OLX adverts into the BuyDUCK catalogue to avoid manual double entry;
- create new OLX adverts from BuyDUCK (title, description, price in UAH, photos, category and required attributes such as size, brand and condition);
- update price, description and photos, deactivate sold items and reactivate them;
- access only the adverts of our own account that authorises the application via OAuth. We do not collect or use data of other sellers or the market.

**Users:** BuyDUCK store staff only (`[number]`). The application is not offered to third parties.

**Volume:** about `[N]` active adverts, `[N]` new adverts per week.

**Security:** the client secret and tokens are stored server-side only; the management panel is restricted to authorised store staff.

**Contacts:** `[name]`, `[email]`, `[phone]`, website: `[domain]`.
