import {createSelector, lruMemoize} from '@reduxjs/toolkit';
import {SelectorFn} from './selectorFn';

/**
 * Any selector, whatever state it reads. A selector of any state is assignable to it,
 * because `never` is assignable to every state type.
 */
type AnySelectorFn = SelectorFn<never, unknown>;

type SelectorResult<TSelector> = TSelector extends (state: never) => infer R ? R : never;

/**
 * A function that takes parameters and returns a selector for them.
 */
export type SelectorFnCreator<TState, TParams extends unknown[], TResult> =
    (...params: TParams) => SelectorFn<TState, TResult>;

/**
 * The results of the given input selectors, in the same order.
 */
export type ResultsOf<TSelectors extends ReadonlyArray<AnySelectorFn>> = {
    [K in keyof TSelectors]: SelectorResult<TSelectors[K]>;
};

/**
 * Takes the parameters and returns the result function, which combines the results of the input selectors.
 */
export type ResultFuncCreator<
    TSelectors extends ReadonlyArray<AnySelectorFn>,
    TParams extends unknown[],
    TResult,
> = (...params: TParams) => (...results: ResultsOf<TSelectors>) => TResult;

/**
 * Which selectors are kept for reuse.
 *
 * - Neither option: only the selector of the most recent parameters.
 * - `maxSize`: the selectors of the `maxSize` most recently used parameters.
 * - `cacheKeyFn`: one selector per key, for every key ever used, or for the `maxSize` most recently used keys.
 *
 * Without `cacheKeyFn`, parameters are compared by reference (`===`).
 */
export type CacheConfig<TParams extends unknown[]> = {
    cacheKeyFn?: (...params: TParams) => string;
    maxSize?: number;
};

/**
 * Creates a memoized selector from input selectors and a result function, the way `createSelector` does.
 */
export type SelectorCreator = (
    selectors: ReadonlyArray<AnySelectorFn>,
    resultFunc: (...results: never[]) => unknown,
) => (state: never) => unknown;

export type WithSelectorsStep<TState> = {
    withSelectors<TSelectors extends ReadonlyArray<SelectorFn<TState, unknown>>>(
        ...selectors: TSelectors
    ): WithResultFunctionStep<TState, TSelectors>;
};

export type WithResultFunctionStep<
    TState,
    TSelectors extends ReadonlyArray<SelectorFn<TState, unknown>>,
> = {
    withResultFuncCreator<TParams extends unknown[], TResult>(
        creator: ResultFuncCreator<TSelectors, TParams, TResult>,
    ): FinalStep<TState, TParams, TResult>;
};

export type FinalStep<TState, TParams extends unknown[], TResult> = {
    withCacheConfig(config: CacheConfig<TParams>): FinalStep<TState, TParams, TResult>;
    build(): SelectorFnCreator<TState, TParams, TResult>;
};

/**
 * Builds a selector that takes parameters: `selectItemsByCategory('books')(state)`.
 *
 * The state type must be given (`aParametrizedSelectorBuilder<RootState>()`), so that the input selectors
 * and the built selector are checked against it.
 *
 * @param selectorCreator creates each selector; Redux Toolkit's `createSelector` unless another is given,
 *   for example `createDraftSafeSelector`.
 */
export function aParametrizedSelectorBuilder<TState>(
    selectorCreator: SelectorCreator = createSelector as SelectorCreator,
): WithSelectorsStep<TState> {
    return {
        withSelectors<TSelectors extends ReadonlyArray<SelectorFn<TState, unknown>>>(
            ...selectors: TSelectors
        ): WithResultFunctionStep<TState, TSelectors> {
            return createWithResultFunctionStep(selectorCreator, selectors);
        },
    };
}

function createWithResultFunctionStep<
    TState,
    TSelectors extends ReadonlyArray<SelectorFn<TState, unknown>>,
>(
    selectorCreator: SelectorCreator,
    selectors: TSelectors,
): WithResultFunctionStep<TState, TSelectors> {
    return {
        withResultFuncCreator<TParams extends unknown[], TResult>(
            resultFuncCreator: ResultFuncCreator<TSelectors, TParams, TResult>,
        ): FinalStep<TState, TParams, TResult> {
            return createFinalStep<TState, TParams, TResult>(
                createSelectorInstanceFactory(selectorCreator, selectors, resultFuncCreator),
            );
        },
    };
}

function createFinalStep<TState, TParams extends unknown[], TResult>(
    createInstance: SelectorFnCreator<TState, TParams, TResult>,
    config: CacheConfig<TParams> = {},
): FinalStep<TState, TParams, TResult> {
    return {
        withCacheConfig(newConfig) {
            return createFinalStep(createInstance, {...config, ...newConfig});
        },

        build() {
            if (config.cacheKeyFn) {
                return createKeyedSelectorFactory(createInstance, config.cacheKeyFn, config.maxSize);
            }

            return lruMemoize(createInstance, config.maxSize ? {maxSize: config.maxSize} : undefined);
        },
    };
}

function createSelectorInstanceFactory<
    TState,
    TSelectors extends ReadonlyArray<SelectorFn<TState, unknown>>,
    TParams extends unknown[],
    TResult,
>(
    selectorCreator: SelectorCreator,
    selectors: TSelectors,
    resultFuncCreator: ResultFuncCreator<TSelectors, TParams, TResult>,
): SelectorFnCreator<TState, TParams, TResult> {
    // The selector creator is typed for any state and result; the types of the builder steps
    // guarantee that the selectors read TState and that the result function returns TResult.
    return (...params: TParams) =>
        selectorCreator(
            selectors,
            resultFuncCreator(...params) as (...results: never[]) => unknown,
        ) as SelectorFn<TState, TResult>;
}

function createKeyedSelectorFactory<TState, TParams extends unknown[], TResult>(
    createInstance: SelectorFnCreator<TState, TParams, TResult>,
    cacheKeyFn: (...params: TParams) => string,
    maxSize?: number,
): SelectorFnCreator<TState, TParams, TResult> {
    // A Map keeps insertion order: re-inserting on every use keeps the least recently used key first.
    const cache = new Map<string, SelectorFn<TState, TResult>>();

    return (...params: TParams) => {
        const key = cacheKeyFn(...params);
        const selector = cache.get(key) ?? createInstance(...params);

        cache.delete(key);
        cache.set(key, selector);

        if (maxSize !== undefined && cache.size > maxSize) {
            const leastRecentlyUsedKey = cache.keys().next().value;
            if (leastRecentlyUsedKey !== undefined) {
                cache.delete(leastRecentlyUsedKey);
            }
        }

        return selector;
    };
}
