# Korimsoft's Slizz

A tiny TypeScript helper library for building clean, predictable Redux Toolkit slices.

It provides lightweight types and utilities for common Redux store patterns, especially normalized slice state, selectors, and payload object creation.

---

## ✨ Features

- 🧱 Simple normalized slice state type
- 🎯 Reusable selector function type
- 🧮 Builder for memoized selectors that take parameters
- 📦 Convenient payload object helpers
- 🧬 Fully typed with TypeScript
- ⚛️ Designed for Redux Toolkit workflows

---

## Installation

```bash
npm install korimsoft-slizz
```

or with pnpm:

```bash
pnpm add korimsoft-slizz@latest
```

Slizz is designed to be used together with Redux Toolkit:

```bash
npm install @reduxjs/toolkit
```

---

## Quick Start

```typescript
import {
  SliceState,
  SelectorFn,
  aPayloadObject,
  payloadObjectCreator,
} from 'korimsoft-slizz';

type Todo = {
  id: string;
  title: string;
  completed: boolean;
};

type TodosState = SliceState<Todo>;

const initialState: TodosState = {
  byId: {},
  allIds: [],
};

const selectTodoIds: SelectorFn<TodosState, string[]> = state => state.allIds;

const payload = aPayloadObject<Todo>({
  id: 'todo-1',
  title: 'Write README',
  completed: false,
});
```

---

## API

### `SliceState<T>`

A normalized Redux slice state shape.

```typescript
import { SliceState } from 'korimsoft-slizz';

type User = {
  id: string;
  name: string;
};

type UsersState = SliceState<User>;

const usersState: UsersState = {
  byId: {
    'user-1': {
      id: 'user-1',
      name: 'Ada Lovelace',
    },
  },
  allIds: ['user-1'],
};
```

The shape is:

```typescript
type SliceState<T> = {
  byId: Record<string, T>;
  allIds: string[];
};
```

This pattern is useful when storing entities by ID while preserving a list of known IDs.

---

### `SelectorFn<TState, TOut>`

A small type alias for strongly typed selector functions.

> Before version 1.0.0 this type was called `ItemSelector`. To upgrade, rename `ItemSelector` to `SelectorFn` in your imports and types; nothing else changed.

```typescript
import { SelectorFn } from 'korimsoft-slizz';

type Product = {
  id: string;
  name: string;
  price: number;
};

type ProductsState = {
  products: {
    byId: Record<string, Product>;
    allIds: string[];
  };
};

const selectProductsState: SelectorFn<
  ProductsState,
  ProductsState['products']
> = state => state.products;

const selectProductIds: SelectorFn<ProductsState, string[]> = state =>
  state.products.allIds;
```

Use it to keep selector declarations expressive and consistent across your app.

---

### `PayloadObject<TOut>`

Represents an object containing a `payload` field.

```typescript
import { PayloadObject } from 'korimsoft-slizz';

type Message = {
  id: string;
  text: string;
};

const actionLikeObject: PayloadObject<Message> = {
  payload: {
    id: 'message-1',
    text: 'Hello from Slizz!',
  },
};
```

---

### `aPayloadObject(payload)`

Creates a payload object from any value.

```typescript
import { aPayloadObject } from 'korimsoft-slizz';

const payloadObject = aPayloadObject({
  id: 'task-1',
  title: 'Ship feature',
});

console.log(payloadObject);
```

Output:

```typescript
{
  payload: {
    id: 'task-1',
    title: 'Ship feature',
  },
}
```

This is useful when you need a small action-like object or want to adapt values into a payload-based structure.

---

### `payloadObjectCreator(mapper)`

Creates a function that maps an input value and wraps the mapped result in a payload object.

```typescript
import { payloadObjectCreator } from 'korimsoft-slizz';

type ApiUser = {
  uuid: string;
  display_name: string;
};

type User = {
  id: string;
  name: string;
};

const toUserPayload = payloadObjectCreator<ApiUser, User>(apiUser => ({
  id: apiUser.uuid,
  name: apiUser.display_name,
}));

const payloadObject = toUserPayload({
  uuid: 'user-1',
  display_name: 'Grace Hopper',
});

console.log(payloadObject);
```

Output:

```typescript
{
  payload: {
    id: 'user-1',
    name: 'Grace Hopper',
  },
}
```

---

### `aParametrizedSelectorBuilder<TState>()`

Builds a memoized selector that takes parameters, such as "the titles of the books in a genre". Calling it with parameters returns a selector made with Redux Toolkit's `createSelector`; calling that selector with the state returns the result.

```typescript
import { aParametrizedSelectorBuilder, SelectorFn } from 'korimsoft-slizz';

type Book = {
  id: string;
  title: string;
  genre: string;
};

type LibraryState = {
  books: Book[];
};

const selectBooks: SelectorFn<LibraryState, Book[]> = state => state.books;

const selectTitlesInGenre = aParametrizedSelectorBuilder<LibraryState>()
  .withSelectors(selectBooks)
  .withResultFuncCreator((genre: string) => (books: Book[]) =>
    books.filter(book => book.genre === genre).map(book => book.title),
  )
  .build();

const titles = selectTitlesInGenre('sci-fi')(state);
```

- `withSelectors(...selectors)`: the input selectors. Their results are passed to the result function in the same order.
- `withResultFuncCreator(creator)`: takes the parameters and returns the result function.
- `withCacheConfig(config)` (optional): which selectors are kept for reuse.
- `build()`: returns the function that takes the parameters.

The state type must be given (`aParametrizedSelectorBuilder<LibraryState>()`); the input selectors and the built selector are checked against it.

Each selector memoizes its result like any `createSelector` selector. Which selectors are kept for reuse depends on the cache config:

| Cache config                    | Selectors kept                                                         |
|---------------------------------|------------------------------------------------------------------------|
| _none_                          | only the one for the most recent parameters                            |
| `{ maxSize: 10 }`               | the ones for the 10 most recently used parameters                      |
| `{ cacheKeyFn }`                | one per key returned by `cacheKeyFn`, for every key ever used           |
| `{ cacheKeyFn, maxSize: 10 }`   | one per key, for the 10 most recently used keys                         |

Without `cacheKeyFn`, parameters are compared by reference (`===`). Pass a `cacheKeyFn` when the parameters are objects created anew on each call:

```typescript
const selectTitlesByFilter = aParametrizedSelectorBuilder<LibraryState>()
  .withSelectors(selectBooks)
  .withResultFuncCreator((filter: { genre: string }) => (books: Book[]) =>
    books.filter(book => book.genre === filter.genre).map(book => book.title),
  )
  .withCacheConfig({ cacheKeyFn: filter => filter.genre, maxSize: 20 })
  .build();

// Both calls return the same selector.
selectTitlesByFilter({ genre: 'sci-fi' });
selectTitlesByFilter({ genre: 'sci-fi' });
```

To create the selectors with something other than `createSelector`, pass it to the builder, for example `aParametrizedSelectorBuilder<LibraryState>(createDraftSafeSelector as SelectorCreator)`.

---

## Redux Toolkit Example

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SliceState, SelectorFn, aPayloadObject } from 'korimsoft-slizz';

type Book = {
  id: string;
  title: string;
  author: string;
};

type BooksState = SliceState<Book>;

const initialState: BooksState = {
  byId: {},
  allIds: [],
};

const booksSlice = createSlice({
  name: 'books',
  initialState,
  reducers: {
    bookAdded(state, action: PayloadAction<Book>) {
      const book = action.payload;

      if (!state.allIds.includes(book.id)) {
        state.allIds.push(book.id);
      }

      state.byId[book.id] = book;
    },

    bookRemoved(state, action: PayloadAction<string>) {
      const bookId = action.payload;

      delete state.byId[bookId];
      state.allIds = state.allIds.filter(id => id !== bookId);
    },
  },
});

export const { bookAdded, bookRemoved } = booksSlice.actions;
export default booksSlice.reducer;

type RootState = {
  books: BooksState;
};

export const selectBookIds: SelectorFn<RootState, string[]> = state =>
  state.books.allIds;

export const selectBooks: SelectorFn<RootState, Book[]> = state =>
  state.books.allIds.map(id => state.books.byId[id]);

export const createBookPayload = (book: Book) => aPayloadObject(book);
```

---

## Normalized State Example

Slizz works well with normalized collections.

```typescript
import { SliceState } from 'korimsoft-slizz';

type Customer = {
  id: string;
  email: string;
};

const customers: SliceState<Customer> = {
  byId: {
    'customer-1': {
      id: 'customer-1',
      email: 'ada@example.com',
    },
    'customer-2': {
      id: 'customer-2',
      email: 'grace@example.com',
    },
  },
  allIds: ['customer-1', 'customer-2'],
};

const allCustomers = customers.allIds.map(id => customers.byId[id]);
```

---

## Mapping External Data

`payloadObjectCreator` is helpful when adapting external API models into internal store models.

```typescript
import { payloadObjectCreator } from 'korimsoft-slizz';

type ApiArticle = {
  article_id: string;
  headline: string;
  published_at: string;
};

type Article = {
  id: string;
  title: string;
  publishedAt: Date;
};

const createArticlePayload = payloadObjectCreator<ApiArticle, Article>(
  apiArticle => ({
    id: apiArticle.article_id,
    title: apiArticle.headline,
    publishedAt: new Date(apiArticle.published_at),
  }),
);

const articlePayload = createArticlePayload({
  article_id: 'article-1',
  headline: 'Slizz makes slices simple',
  published_at: '2026-05-21T10:00:00.000Z',
});
```

---

## Package Scripts

```bash
pnpm build
```

Builds the package.

```bash
pnpm test
```

Runs tests.

```bash
pnpm test:watch
```

Runs tests in watch mode.

```bash
pnpm test:coverage
```

Runs tests with coverage.

---

## Releasing

Every pull request merged into `main` is released to npm automatically by `.github/workflows/publish-npm.yml`. Nobody runs a release command, and direct pushes to `main` are not allowed.

The label on the merged pull request decides the new version:

| Label           | Version change | Example       |
|-----------------|----------------|---------------|
| _none_          | patch          | 0.2.1 → 0.2.2 |
| `release:minor` | minor          | 0.2.1 → 0.3.0 |
| `release:major` | major          | 0.2.1 → 1.0.0 |

The workflow runs the build and tests, pushes the tag `vX.Y.Z` and publishes with npm provenance. If the tests fail, nothing is published.

The version in `package.json` on `main` is **not** updated: the git tags and npm show the released version. If a publish fails after the tag was pushed, rerun the workflow and it retries the same version.

---

## TypeScript

Slizz is written in TypeScript and ships with type declarations.

```typescript
import type { SliceState, SelectorFn, PayloadObject } from 'korimsoft-slizz';
```

---

## License

MIT

---

## Author

Created by **Korimsoft**.

