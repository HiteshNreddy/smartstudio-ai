export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "owner" | "admin" | "engineer" | "artist";
export type BookingStatus = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
export type ProjectStatus =
  | "in-progress"
  | "mixing"
  | "mastering"
  | "delivered"
  | "on-hold";
export type InvoiceStatus = "draft" | "paid" | "refunded" | "cancelled";

export interface Database {
  public: {
    Tables: {
      studios: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      studio_memberships: {
        Row: {
          id: string;
          studio_id: string;
          user_id: string;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          user_id: string;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          user_id?: string;
          role?: UserRole;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rooms: {
        Row: {
          id: string;
          studio_id: string;
          name: string;
          description: string | null;
          hourly_rate: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          name: string;
          description?: string | null;
          hourly_rate?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          name?: string;
          description?: string | null;
          hourly_rate?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      artists: {
        Row: {
          id: string;
          studio_id: string;
          profile_id: string | null;
          name: string;
          genre: string | null;
          email: string | null;
          phone: string | null;
          status: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          profile_id?: string | null;
          name: string;
          genre?: string | null;
          email?: string | null;
          phone?: string | null;
          status?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          profile_id?: string | null;
          name?: string;
          genre?: string | null;
          email?: string | null;
          phone?: string | null;
          status?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          studio_id: string;
          room_id: string;
          artist_id: string;
          start_time: string;
          end_time: string;
          status: BookingStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          room_id: string;
          artist_id: string;
          start_time: string;
          end_time: string;
          status?: BookingStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          room_id?: string;
          artist_id?: string;
          start_time?: string;
          end_time?: string;
          status?: BookingStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          studio_id: string;
          artist_id: string;
          title: string;
          type: string | null;
          progress: number | null;
          tracks: number | null;
          deadline: string | null;
          status: ProjectStatus | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          artist_id: string;
          title: string;
          type?: string | null;
          progress?: number | null;
          tracks?: number | null;
          deadline?: string | null;
          status?: ProjectStatus | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          artist_id?: string;
          title?: string;
          type?: string | null;
          progress?: number | null;
          tracks?: number | null;
          deadline?: string | null;
          status?: ProjectStatus | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          studio_id: string;
          booking_id: string | null;
          artist_id: string;
          amount_cents: number;
          status: InvoiceStatus;
          due_date: string | null;
          paid_at: string | null;
          stripe_payment_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          booking_id?: string | null;
          artist_id: string;
          amount_cents: number;
          status?: InvoiceStatus;
          due_date?: string | null;
          paid_at?: string | null;
          stripe_payment_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          booking_id?: string | null;
          artist_id?: string;
          amount_cents?: number;
          status?: InvoiceStatus;
          due_date?: string | null;
          paid_at?: string | null;
          stripe_payment_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          studio_id: string;
          user_id: string | null;
          action: string;
          target_type: string;
          target_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          studio_id: string;
          user_id?: string | null;
          action: string;
          target_type: string;
          target_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          studio_id?: string;
          user_id?: string | null;
          action?: string;
          target_type?: string;
          target_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_studio: {
        Args: {
          studio_name: string;
          studio_slug: string;
        };
        Returns: string;
      };
      get_user_studios: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      has_role_on_studio: {
        Args: {
          check_studio_id: string;
          required_roles: UserRole[];
        };
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      booking_status: BookingStatus;
      project_status: ProjectStatus;
      invoice_status: InvoiceStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
