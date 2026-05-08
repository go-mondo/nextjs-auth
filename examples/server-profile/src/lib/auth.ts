import { createAuth } from '@go-mondo/nextjs-auth';

type ExampleClaims = {
  roles?: string[];
  org_id?: string;
};

export const auth = createAuth<ExampleClaims>();
