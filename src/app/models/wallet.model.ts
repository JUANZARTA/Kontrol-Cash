export class WalletAccount {
  constructor(
    
    public tipo: string,
    public valor: number
  ) {}
}

export interface WalletAccountWithId extends WalletAccount {
  id: string;
  showMenu?: boolean;
}
