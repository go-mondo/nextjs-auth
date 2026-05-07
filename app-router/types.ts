export type ParamsPromise = Promise<Record<string, string | string[]>>;
export type SearchParamsPromise = Promise<{
  [key: string]: string | string[] | undefined;
}>;

/**
 * Objects containing the route parameters and search parameters of th page.
 *
 * @category Server
 */
export type AppRouterOpts<
  Params = ParamsPromise,
  SearchParams = SearchParamsPromise,
> = {
  params: Params;
  searchParams: SearchParams;
};

/**
 * An app route
 *
 * @category Server
 */
export type AppRouterPageRoute<
  Params = ParamsPromise,
  SearchParams = SearchParamsPromise,
> = (obj: AppRouterOpts<Params, SearchParams>) => Promise<React.JSX.Element>;
