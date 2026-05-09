export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          cnpj: string;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          cnpj: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          cnpj?: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      users: {
        Row: {
          id: string;
          company_id: string;
          email: string;
          password_hash: string | null;
          full_name: string | null;
          created_at: string | null;
          last_login: string | null;
        };
        Insert: {
          id: string;
          company_id: string;
          email: string;
          password_hash?: string | null;
          full_name?: string | null;
          created_at?: string | null;
          last_login?: string | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          email?: string;
          password_hash?: string | null;
          full_name?: string | null;
          created_at?: string | null;
          last_login?: string | null;
        };
      };
      bank_accounts: {
        Row: {
          id: string;
          company_id: string;
          bank_name: string;
          agency: string | null;
          account_number: string | null;
          account_type: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          bank_name: string;
          agency?: string | null;
          account_number?: string | null;
          account_type?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          bank_name?: string;
          agency?: string | null;
          account_number?: string | null;
          account_type?: string | null;
          created_at?: string | null;
        };
      };
      statements: {
        Row: {
          id: string;
          account_id: string;
          period_start: string;
          period_end: string;
          initial_balance: number | null;
          final_balance: number | null;
          file_name: string | null;
          file_url: string | null;
          uploaded_at: string | null;
          status: 'processing' | 'completed' | 'error';
        };
        Insert: {
          id?: string;
          account_id: string;
          period_start: string;
          period_end: string;
          initial_balance?: number | null;
          final_balance?: number | null;
          file_name?: string | null;
          file_url?: string | null;
          uploaded_at?: string | null;
          status?: 'processing' | 'completed' | 'error';
        };
        Update: {
          id?: string;
          account_id?: string;
          period_start?: string;
          period_end?: string;
          initial_balance?: number | null;
          final_balance?: number | null;
          file_name?: string | null;
          file_url?: string | null;
          uploaded_at?: string | null;
          status?: 'processing' | 'completed' | 'error';
        };
      };
      categories: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          type: 'income' | 'expense';
          color: string;
          keywords: string[] | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          type: 'income' | 'expense';
          color: string;
          keywords?: string[] | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          type?: 'income' | 'expense';
          color?: string;
          keywords?: string[] | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      transactions: {
        Row: {
          id: string;
          statement_id: string;
          category_id: string | null;
          date: string;
          description: string;
          document_number: string | null;
          type: 'credit' | 'debit';
          amount: number;
          balance_after: number | null;
          is_manual: boolean | null;
          is_hidden: boolean | null;
          notes: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          statement_id: string;
          category_id?: string | null;
          date: string;
          description: string;
          document_number?: string | null;
          type: 'credit' | 'debit';
          amount: number;
          balance_after?: number | null;
          is_manual?: boolean | null;
          is_hidden?: boolean | null;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          statement_id?: string;
          category_id?: string | null;
          date?: string;
          description?: string;
          document_number?: string | null;
          type?: 'credit' | 'debit';
          amount?: number;
          balance_after?: number | null;
          is_manual?: boolean | null;
          is_hidden?: boolean | null;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
    };
    Functions: {
      get_top_categories: {
        Args: {
          p_statement_id: string;
          p_limit: number;
        };
        Returns: {
          category_id: string;
          category_name: string;
          category_color: string;
          total_amount: number;
          transaction_count: number;
        }[];
      };
      get_daily_balance: {
        Args: {
          p_statement_id: string;
        };
        Returns: {
          date: string;
          total_in: number;
          total_out: number;
          end_balance: number;
          transaction_count: number;
        }[];
      };
    };
    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
