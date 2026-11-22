import {createSelector} from '@reduxjs/toolkit';
import {aParametrizedSelectorBuilder, ResultFuncCreator, SelectorCreator, SelectorFn, SelectorFnCreator} from '../src';

type Book = {
    id: string;
    title: string;
    genre: string;
};

type LibraryState = {
    libraryName: string;
    books: Book[];
};

const dune: Book = {id: 'book-dune', title: 'Dune', genre: 'sci-fi'};
const solaris: Book = {id: 'book-solaris', title: 'Solaris', genre: 'sci-fi'};
const emma: Book = {id: 'book-emma', title: 'Emma', genre: 'classic'};

/**
 * A library with no books. Tests whose result depends on the name or the books pass them explicitly.
 */
const givenALibraryState = (overrides: Partial<LibraryState> = {}): LibraryState => ({
    libraryName: 'Any Library',
    books: [],
    ...overrides,
});

const selectLibraryName: SelectorFn<LibraryState, string> = state => state.libraryName;
const selectBooks: SelectorFn<LibraryState, Book[]> = state => state.books;

const titlesInGenre = (genre: string) => (books: Book[]): string[] =>
    books.filter(book => book.genre === genre).map(book => book.title);

const aSelectTitlesInGenre = () => aParametrizedSelectorBuilder<LibraryState>()
    .withSelectors(selectBooks)
    .withResultFuncCreator(titlesInGenre);

describe('parametrizedSelectorBuilder', () => {
    it('Should build a selector that combines the input selectors with the parameters', () => {
        const givenState = givenALibraryState({
            libraryName: 'Municipal Library of Prague',
            books: [dune, solaris, emma],
        });
        const givenResultFuncCreator: ResultFuncCreator<
            [SelectorFn<LibraryState, string>, SelectorFn<LibraryState, Book[]>],
            [string, boolean],
            string
        > = (genre, uppercase) => (libraryName, books) => {
            const titles = titlesInGenre(genre)(books).join(', ');
            return `${libraryName}: ${uppercase ? titles.toUpperCase() : titles}`;
        };

        const selectGenreSummary: SelectorFnCreator<LibraryState, [string, boolean], string> =
            aParametrizedSelectorBuilder<LibraryState>()
                .withSelectors(selectLibraryName, selectBooks)
                .withResultFuncCreator(givenResultFuncCreator)
                .build();

        expect(selectGenreSummary('sci-fi', false)(givenState)).toBe('Municipal Library of Prague: Dune, Solaris');
        expect(selectGenreSummary('sci-fi', true)(givenState)).toBe('Municipal Library of Prague: DUNE, SOLARIS');
    });

    it('Should memoize the result of a selector for states with the same input selector results', () => {
        const givenBooks = [dune, solaris];
        const givenFirstState = givenALibraryState({libraryName: 'Municipal Library of Prague', books: givenBooks});
        const givenSecondState = givenALibraryState({libraryName: 'City Library of Brno', books: givenBooks});
        const resultFunc = jest.fn(titlesInGenre('sci-fi'));
        const selectTitlesInGenre = aParametrizedSelectorBuilder<LibraryState>()
            .withSelectors(selectBooks)
            .withResultFuncCreator((_genre: string) => resultFunc)
            .build();

        const selector = selectTitlesInGenre('sci-fi');
        const firstResult = selector(givenFirstState);
        const secondResult = selector(givenSecondState);

        expect(secondResult).toBe(firstResult);
        expect(resultFunc).toHaveBeenCalledTimes(1);
    });

    it('Should return the same selector for the same parameters used twice in a row with the default cache', () => {
        const selectTitlesInGenre = aSelectTitlesInGenre().build();

        expect(selectTitlesInGenre('sci-fi')).toBe(selectTitlesInGenre('sci-fi'));
    });

    it('Should keep only the selector of the most recent parameters by default', () => {
        const selectTitlesInGenre = aSelectTitlesInGenre().build();

        const firstSciFiSelector = selectTitlesInGenre('sci-fi');
        selectTitlesInGenre('classic');

        expect(selectTitlesInGenre('sci-fi')).not.toBe(firstSciFiSelector);
    });

    it('Should keep the selectors of the maxSize most recently used parameters', () => {
        const selectTitlesInGenre = aSelectTitlesInGenre()
            .withCacheConfig({maxSize: 2})
            .build();

        const sciFiSelector = selectTitlesInGenre('sci-fi');
        const classicSelector = selectTitlesInGenre('classic');

        expect(selectTitlesInGenre('sci-fi')).toBe(sciFiSelector);
        expect(selectTitlesInGenre('classic')).toBe(classicSelector);

        selectTitlesInGenre('poetry');

        expect(selectTitlesInGenre('sci-fi')).not.toBe(sciFiSelector);
    });

    it('Should return the same selector for parameters with the same cache key', () => {
        type GenreFilter = { genre: string };
        const selectTitlesInGenre = aParametrizedSelectorBuilder<LibraryState>()
            .withSelectors(selectBooks)
            .withResultFuncCreator((filter: GenreFilter) => titlesInGenre(filter.genre))
            .withCacheConfig({cacheKeyFn: filter => filter.genre})
            .build();

        const sciFiSelector = selectTitlesInGenre({genre: 'sci-fi'});
        selectTitlesInGenre({genre: 'classic'});

        expect(selectTitlesInGenre({genre: 'sci-fi'})).toBe(sciFiSelector);
        expect(sciFiSelector(givenALibraryState({books: [dune, emma]}))).toEqual(['Dune']);
    });

    it('Should drop the least recently used cache key when there are more than maxSize keys', () => {
        const selectTitlesInGenre = aSelectTitlesInGenre()
            .withCacheConfig({cacheKeyFn: genre => genre})
            .withCacheConfig({maxSize: 2})
            .build();

        const sciFiSelector = selectTitlesInGenre('sci-fi');
        const classicSelector = selectTitlesInGenre('classic');
        selectTitlesInGenre('sci-fi');
        selectTitlesInGenre('poetry');

        expect(selectTitlesInGenre('sci-fi')).toBe(sciFiSelector);
        expect(selectTitlesInGenre('classic')).not.toBe(classicSelector);
    });

    it('Should not change a builder step when a cache config is added to it', () => {
        const finalStep = aSelectTitlesInGenre();
        finalStep.withCacheConfig({maxSize: 2});
        const selectWithDefaultCache = finalStep.build();

        const sciFiSelector = selectWithDefaultCache('sci-fi');
        selectWithDefaultCache('classic');

        expect(selectWithDefaultCache('sci-fi')).not.toBe(sciFiSelector);
    });

    it('Should create the selectors with the given selector creator', () => {
        const selectorCreator = jest.fn(createSelector as SelectorCreator);
        const selectTitlesInGenre = aParametrizedSelectorBuilder<LibraryState>(selectorCreator)
            .withSelectors(selectBooks)
            .withResultFuncCreator(titlesInGenre)
            .build();

        const titles = selectTitlesInGenre('classic')(givenALibraryState({books: [dune, emma]}));

        expect(titles).toEqual(['Emma']);
        expect(selectorCreator).toHaveBeenCalledTimes(1);
    });
});
