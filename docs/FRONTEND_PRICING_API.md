# Ціни — інструкція для фронтенду

Ціни зберігаються в Strapi як **single type «Ціни»** (`api::pricing.pricing`). Ті самі значення використовуються для:

- відображення на сайті (через API);
- створення платежів WayForPay;
- перевірки суми в callback після оплати.

Після зміни цін у **Content Manager → Ціни** оновлюються і UI, і платежі — достатньо не тримати захардкоджені суми на фронті.

---

## Як підключитися

### 1. URL бекенду

Як у [FRONTEND_AUTH_API.md](./FRONTEND_AUTH_API.md):

```env
VITE_API_URL=http://localhost:1337
# або NEXT_PUBLIC_API_URL=... / REACT_APP_API_URL=...
```

```ts
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337';
// запит: `${API_URL}/api/pricing`  →  http://localhost:1337/api/pricing
```

**Важливо:** у `VITE_API_URL` / `NEXT_PUBLIC_API_URL` **не** додавайте `/api` в кінець.

| Змінна оточення | Як формувати URL |
|-----------------|------------------|
| `http://localhost:1337` | `${API_URL}/api/pricing` ✅ |
| `http://localhost:1337/api` | `${API_URL}/pricing` ✅ (без другого `/api`) |

Якщо бачите **404** на `http://localhost:1337/api/api/pricing` — подвоєний префікс: або приберіть `/api` з env, або з коду виклику.

### 2. Права в Strapi (один раз)

**Settings → Users & Permissions Plugin → Roles → Public**

Увімкнути для **Pricing**:

- `find`

Без цього `GET /api/pricing` поверне **403 Forbidden**.

> Якщо ціни показуються лише залогіненим користувачам — увімкніть `find` для ролі **Authenticated** і передавайте JWT (див. нижче).

### 3. CORS

Якщо фронт на іншому порту/домені — додайте origin у `config/middlewares.ts` на бекенді (див. [FRONTEND_AUTH_API.md](./FRONTEND_AUTH_API.md)).

---

## Отримати ціни

**GET** `/api/pricing`

**Auth:** не потрібен (за умови Public → `find`).

**Успіх (200)** — приклад (Strapi 5):

```json
{
  "data": {
    "id": 1,
    "documentId": "abc123xyz",
    "makCardsPrice": 1890,
    "mediumPrice": 3990,
    "premiumPrice": 4990,
    "sectionPrice": 890,
    "currency": "UAH",
    "createdAt": "2026-05-16T12:00:00.000Z",
    "updatedAt": "2026-05-16T12:00:00.000Z"
  },
  "meta": {}
}
```

### Поля

| Поле в API       | Опис                         | Використання на фронті      |
|------------------|------------------------------|-----------------------------|
| `makCardsPrice`  | Доступ до МАК-карток         | `POST /api/mak-cards/access` |
| `mediumPrice`    | Тариф Medium                 | `POST /api/tariffs/medium/activate` |
| `premiumPrice`   | Тариф Premium                | `POST /api/tariffs/premium/activate` |
| `sectionPrice`   | Один розділ методики         | `POST /api/user-method-sections/assign` |
| `currency`       | Валюта (зазвичай `UAH`)      | Підпис біля суми, порівняння з відповіддю оплати |

### Значення за замовчуванням (якщо запис ще не створений)

При першому старті бекенд створює запис із такими цінами:

| Поле            | Значення |
|-----------------|----------|
| `makCardsPrice` | 1890     |
| `mediumPrice`   | 3990     |
| `premiumPrice`  | 4990     |
| `sectionPrice`  | 890      |
| `currency`      | UAH      |

---

## Рекомендований хелпер (TypeScript)

```ts
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337';

export type Pricing = {
  makCardsPrice: number;
  mediumPrice: number;
  premiumPrice: number;
  sectionPrice: number;
  currency: string;
};

export async function fetchPricing(): Promise<Pricing> {
  const res = await fetch(`${API_URL}/api/pricing`, {
    // Next.js App Router — кеш на 60 с, щоб не бити API на кожен рендер:
    next: { revalidate: 60 },
  });
  // Vite / CRA без Next — замість next:
  // cache: 'default',

  if (!res.ok) {
    throw new Error('Failed to load pricing');
  }

  const json = await res.json();
  const data = json.data;

  return {
    makCardsPrice: data.makCardsPrice,
    mediumPrice: data.mediumPrice,
    premiumPrice: data.premiumPrice,
    sectionPrice: data.sectionPrice,
    currency: data.currency ?? 'UAH',
  };
}
```

### Відображення в компоненті (React)

```tsx
import { useEffect, useState } from 'react';
import { fetchPricing, type Pricing } from '@/lib/pricing';

export function TariffCard({ variant }: { variant: 'medium' | 'premium' }) {
  const [pricing, setPricing] = useState<Pricing | null>(null);

  useEffect(() => {
    fetchPricing()
      .then(setPricing)
      .catch(console.error);
  }, []);

  if (!pricing) return <p>Завантаження…</p>;

  const amount =
    variant === 'medium' ? pricing.mediumPrice : pricing.premiumPrice;

  return (
    <div>
      <h3>{variant === 'medium' ? 'Medium' : 'Premium'}</h3>
      <p>
        {amount} {pricing.currency}
      </p>
    </div>
  );
}
```

### Server Component (Next.js)

```tsx
import { fetchPricing } from '@/lib/pricing';

export default async function PricingPage() {
  const pricing = await fetchPricing();

  return (
    <ul>
      <li>Medium — {pricing.mediumPrice} {pricing.currency}</li>
      <li>Premium — {pricing.premiumPrice} {pricing.currency}</li>
      <li>Розділ методики — {pricing.sectionPrice} {pricing.currency}</li>
      <li>МАК-картки — {pricing.makCardsPrice} {pricing.currency}</li>
    </ul>
  );
}
```

---

## Зв’язок з оплатою

Після ініціалізації оплати бекенд повертає фактичну суму в тілі відповіді, наприклад:

```json
{
  "status": "payment_required",
  "kind": "medium",
  "amount": 3990,
  "currency": "UAH",
  "paymentUrl": "https://secure.wayforpay.com/..."
}
```

**Рекомендація:** на сторінці тарифів показуйте ціни з `GET /api/pricing`. Після `POST .../activate` або `.../assign` можна додатково звірити `amount` / `currency` з відповіддю оплати — вони мають збігатися з адмінкою.

| Дія на фронті              | Ендпоінт оплати                          | Поле ціни в `/api/pricing` |
|----------------------------|------------------------------------------|----------------------------|
| МАК-картки                 | `POST /api/mak-cards/access`             | `makCardsPrice`            |
| Тариф Medium               | `POST /api/tariffs/medium/activate`      | `mediumPrice`              |
| Тариф Premium              | `POST /api/tariffs/premium/activate`     | `premiumPrice`             |
| Розділ методики            | `POST /api/user-method-sections/assign`  | `sectionPrice`             |

Деталі платіжних ендпоінтів — у [FRONTEND_AUTH_API.md](./FRONTEND_AUTH_API.md).

---

## Редагування цін (адмінка)

1. Увійти в Strapi Admin.
2. **Content Manager → Ціни**.
3. Змінити потрібні поля → **Save**.
4. На фронті: оновити сторінку або дочекатися закінчення `revalidate` (якщо використовується кеш Next.js).

Окремий деплой бекенду для зміни цін **не потрібен**.

---

## Помилки

| Код | Причина |
|-----|---------|
| **403** | Не увімкнено `find` для Pricing у ролі Public (або Authenticated, якщо запит з JWT). |
| **404** на `/api/api/pricing` | Подвоєний `/api` — див. розділ «URL бекенду» вище. |
| **404** на `/api/pricing` | Single type ще не створений — перезапустіть бекенд (`pnpm develop`); при bootstrap має з’явитися запис за замовчуванням. |

---

## Підсумок

| Дія              | Method | URL            | Auth   |
|------------------|--------|----------------|--------|
| Отримати ціни    | GET    | `/api/pricing` | Ні*    |

\* За умови Public → Pricing → `find`.
