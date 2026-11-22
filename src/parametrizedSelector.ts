import {createSelector, lruMemoize} from '@reduxjs/toolkit';
import {SelectorFn} from './selectorFn';

type AnySelectorFn = SelectorFn<never, unknown>;

type SelectorResult<TSelector> = TSelector extends (state: never) => infer R ? R : never;

export type SelectorFnCreator<TState, TParams extends unknown[], TResult> =
    (...params: TParams) => SelectorFn<TState, TResult>;

export type ResultsOf<TSelectors extends ReadonlyArray<AnySelectorFn>> = {
    [K in keyof TSelectors]: SelectorResult<TSelectors[K]>;
};

export type ResultFuncCreator<
    TSelectors extends ReadonlyArray<AnySelectorFn>,
    TParams extends unknown[],
    TResult,
> = (...params: TParams) => (...results: ResultsOf<TSelectors>) => TResult;

export type CacheConfig<TParams extends unknown[]> = {
    cacheKeyFn?: (...params: TParams) => string;
    maxSize?: number;
};

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
