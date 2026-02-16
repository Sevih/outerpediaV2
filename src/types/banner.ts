export type Banner = {
  id: string;
  name: string;
  start: string;
  end: string;
};

export type PromoCode = {
  code: string;
  description: Record<string, string>;
  start: string;
  end: string;
};
