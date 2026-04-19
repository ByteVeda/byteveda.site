export type Maintainer = {
  login: string;
  name: string;
  role: string;
};

export type ContributeStep = {
  number: string;
  title: string;
  description: string;
  command?: string;
};
