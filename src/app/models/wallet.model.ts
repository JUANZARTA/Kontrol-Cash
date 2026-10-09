export class WalletAccount {
  constructor(
    public tipo: string,
    public valor: number,
    public fijo?: boolean
  ) {}
}

export interface WalletAccountWithId extends WalletAccount {
  id: string;
  showMenu?: boolean;
}
