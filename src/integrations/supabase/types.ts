export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          estate_id: string | null
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          estate_id?: string | null
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          estate_id?: string | null
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string
          estate_id: string
          id: string
          resident_id: string
          status: Database["public"]["Enums"]["bill_status"]
          title: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date: string
          estate_id: string
          id?: string
          resident_id: string
          status?: Database["public"]["Enums"]["bill_status"]
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string
          estate_id?: string
          id?: string
          resident_id?: string
          status?: Database["public"]["Enums"]["bill_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_id: string | null
          body: string
          cover_url: string | null
          created_at: string
          estate_id: string
          id: string
          post_type: string
          title: string
        }
        Insert: {
          author_id?: string | null
          body: string
          cover_url?: string | null
          created_at?: string
          estate_id: string
          id?: string
          post_type?: string
          title: string
        }
        Update: {
          author_id?: string | null
          body?: string
          cover_url?: string | null
          created_at?: string
          estate_id?: string
          id?: string
          post_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      dependents: {
        Row: {
          age: number | null
          created_at: string
          estate_id: string
          full_name: string
          id: string
          phone: string | null
          relationship: string | null
          resident_id: string
        }
        Insert: {
          age?: number | null
          created_at?: string
          estate_id: string
          full_name: string
          id?: string
          phone?: string | null
          relationship?: string | null
          resident_id: string
        }
        Update: {
          age?: number | null
          created_at?: string
          estate_id?: string
          full_name?: string
          id?: string
          phone?: string | null
          relationship?: string | null
          resident_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dependents_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      estate_admin_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string | null
          email: string
          estate_id: string
          expires_at: string
          id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          estate_id: string
          expires_at?: string
          id?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          estate_id?: string
          expires_at?: string
          id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "estate_admin_invites_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      estate_contacts: {
        Row: {
          created_at: string
          email: string | null
          estate_id: string
          id: string
          label: string
          phone: string | null
          role: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          estate_id: string
          id?: string
          label: string
          phone?: string | null
          role?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          estate_id?: string
          id?: string
          label?: string
          phone?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estate_contacts_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      estates: {
        Row: {
          address: string | null
          admin_user_id: string | null
          city: string | null
          code: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          state: string | null
          status: Database["public"]["Enums"]["estate_status"]
        }
        Insert: {
          address?: string | null
          admin_user_id?: string | null
          city?: string | null
          code: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          state?: string | null
          status?: Database["public"]["Enums"]["estate_status"]
        }
        Update: {
          address?: string | null
          admin_user_id?: string | null
          city?: string | null
          code?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          state?: string | null
          status?: Database["public"]["Enums"]["estate_status"]
        }
        Relationships: []
      }
      event_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      event_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          event_id: string | null
          id: string
          meta: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          meta?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          meta?: Json
        }
        Relationships: [
          {
            foreignKeyName: "event_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity: number | null
          category_id: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          estate_id: string | null
          faqs: Json
          id: string
          organizer_id: string
          price: number
          schedule: Json
          starts_at: string
          status: string
          title: string
          updated_at: string
          venue: string
          visibility: string
        }
        Insert: {
          capacity?: number | null
          category_id?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          estate_id?: string | null
          faqs?: Json
          id?: string
          organizer_id: string
          price?: number
          schedule?: Json
          starts_at: string
          status?: string
          title: string
          updated_at?: string
          venue: string
          visibility?: string
        }
        Update: {
          capacity?: number | null
          category_id?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          estate_id?: string | null
          faqs?: Json
          id?: string
          organizer_id?: string
          price?: number
          schedule?: Json
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
          venue?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "event_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_invites: {
        Row: {
          checked_in_at: string | null
          checked_out_at: string | null
          code: string
          created_at: string
          estate_id: string
          exited_by: string | null
          expires_at: string
          guest_name: string
          id: string
          num_guests: number
          phone: string | null
          purpose: string | null
          resident_id: string
          status: Database["public"]["Enums"]["invite_status"]
          updated_at: string
          validated_by: string | null
          vehicle_number: string | null
          visit_time: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_out_at?: string | null
          code: string
          created_at?: string
          estate_id: string
          exited_by?: string | null
          expires_at: string
          guest_name: string
          id?: string
          num_guests?: number
          phone?: string | null
          purpose?: string | null
          resident_id: string
          status?: Database["public"]["Enums"]["invite_status"]
          updated_at?: string
          validated_by?: string | null
          vehicle_number?: string | null
          visit_time: string
        }
        Update: {
          checked_in_at?: string | null
          checked_out_at?: string | null
          code?: string
          created_at?: string
          estate_id?: string
          exited_by?: string | null
          expires_at?: string
          guest_name?: string
          id?: string
          num_guests?: number
          phone?: string | null
          purpose?: string | null
          resident_id?: string
          status?: Database["public"]["Enums"]["invite_status"]
          updated_at?: string
          validated_by?: string | null
          vehicle_number?: string | null
          visit_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_invites_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          category: string | null
          created_at: string
          description: string
          estate_id: string
          id: string
          location: string | null
          reporter_id: string | null
          reporter_role: Database["public"]["Enums"]["app_role"] | null
          resident_id: string | null
          responded_at: string | null
          responded_by: string | null
          response: string | null
          severity: Database["public"]["Enums"]["issue_severity"]
          status: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description: string
          estate_id: string
          id?: string
          location?: string | null
          reporter_id?: string | null
          reporter_role?: Database["public"]["Enums"]["app_role"] | null
          resident_id?: string | null
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          status?: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string
          estate_id?: string
          id?: string
          location?: string | null
          reporter_id?: string | null
          reporter_role?: Database["public"]["Enums"]["app_role"] | null
          resident_id?: string | null
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          status?: Database["public"]["Enums"]["issue_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          estate_id: string
          id: string
          join_url: string | null
          location: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          estate_id: string
          id?: string
          join_url?: string | null
          location?: string | null
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          estate_id?: string
          id?: string
          join_url?: string | null
          location?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          estate_id: string | null
          id: string
          link_to: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          estate_id?: string | null
          id?: string
          link_to?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          estate_id?: string | null
          id?: string
          link_to?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bill_id: string
          estate_id: string
          id: string
          method: string
          paid_at: string
          resident_id: string
        }
        Insert: {
          amount: number
          bill_id: string
          estate_id: string
          id?: string
          method?: string
          paid_at?: string
          resident_id: string
        }
        Update: {
          amount?: number
          bill_id?: string
          estate_id?: string
          id?: string
          method?: string
          paid_at?: string
          resident_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          option_key: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          option_key: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          option_key?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          closes_at: string | null
          created_at: string
          description: string | null
          estate_id: string
          id: string
          options: Json
          title: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          description?: string | null
          estate_id: string
          id?: string
          options?: Json
          title: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          description?: string | null
          estate_id?: string
          id?: string
          options?: Json
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address_code: string | null
          approved: boolean
          avatar_url: string | null
          block: string | null
          created_at: string
          email: string | null
          estate_id: string | null
          full_name: string
          house_number: string | null
          id: string
          occupant_type: Database["public"]["Enums"]["occupant_type"] | null
          phone: string | null
          premium_expires_at: string | null
          premium_plan: string | null
          street: string | null
          unit: string | null
          updated_at: string
          verification_doc_path: string | null
          verification_notes: string | null
          verification_reviewed_at: string | null
          verification_reviewed_by: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          verification_submitted_at: string | null
        }
        Insert: {
          address_code?: string | null
          approved?: boolean
          avatar_url?: string | null
          block?: string | null
          created_at?: string
          email?: string | null
          estate_id?: string | null
          full_name?: string
          house_number?: string | null
          id: string
          occupant_type?: Database["public"]["Enums"]["occupant_type"] | null
          phone?: string | null
          premium_expires_at?: string | null
          premium_plan?: string | null
          street?: string | null
          unit?: string | null
          updated_at?: string
          verification_doc_path?: string | null
          verification_notes?: string | null
          verification_reviewed_at?: string | null
          verification_reviewed_by?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verification_submitted_at?: string | null
        }
        Update: {
          address_code?: string | null
          approved?: boolean
          avatar_url?: string | null
          block?: string | null
          created_at?: string
          email?: string | null
          estate_id?: string | null
          full_name?: string
          house_number?: string | null
          id?: string
          occupant_type?: Database["public"]["Enums"]["occupant_type"] | null
          phone?: string | null
          premium_expires_at?: string | null
          premium_plan?: string | null
          street?: string | null
          unit?: string | null
          updated_at?: string
          verification_doc_path?: string | null
          verification_notes?: string | null
          verification_reviewed_at?: string | null
          verification_reviewed_by?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verification_submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          attendee_name: string
          attendee_phone: string | null
          checked_in_at: string | null
          created_at: string
          event_id: string
          id: string
          status: string
          ticket_id: string | null
          user_id: string
          validation_code: string
        }
        Insert: {
          attendee_name: string
          attendee_phone?: string | null
          checked_in_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          status?: string
          ticket_id?: string | null
          user_id: string
          validation_code: string
        }
        Update: {
          attendee_name?: string
          attendee_phone?: string | null
          checked_in_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          status?: string
          ticket_id?: string | null
          user_id?: string
          validation_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      resident_ids: {
        Row: {
          created_at: string
          doc_path: string | null
          id: string
          id_number: string
          id_type: string
          resident_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          doc_path?: string | null
          id?: string
          id_number: string
          id_type: string
          resident_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          doc_path?: string | null
          id?: string
          id_number?: string
          id_type?: string
          resident_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      resident_requests: {
        Row: {
          admin_notes: string | null
          category: string
          created_at: string
          details: string | null
          estate_id: string
          id: string
          resident_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          category: string
          created_at?: string
          details?: string | null
          estate_id: string
          id?: string
          resident_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          details?: string | null
          estate_id?: string
          id?: string
          resident_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resident_requests_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_items: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string | null
          estate_id: string
          id: string
          image_url: string | null
          name: string
          price_ngn: number
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          estate_id: string
          id?: string
          image_url?: string | null
          name: string
          price_ngn?: number
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          estate_id?: string
          id?: string
          image_url?: string | null
          name?: string
          price_ngn?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_items_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_orders: {
        Row: {
          amount_ngn: number
          created_at: string
          estate_id: string
          id: string
          item_id: string | null
          item_name: string
          notes: string | null
          quantity: number
          resident_id: string
          status: string
        }
        Insert: {
          amount_ngn?: number
          created_at?: string
          estate_id: string
          id?: string
          item_id?: string | null
          item_name: string
          notes?: string | null
          quantity?: number
          resident_id: string
          status?: string
        }
        Update: {
          amount_ngn?: number
          created_at?: string
          estate_id?: string
          id?: string
          item_id?: string | null
          item_name?: string
          notes?: string | null
          quantity?: number
          resident_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_orders_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_orders_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          body: string
          created_at: string
          estate_id: string
          id: string
          resident_id: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          estate_id: string
          id?: string
          resident_id: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          estate_id?: string
          id?: string
          resident_id?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          created_at: string
          event_id: string
          id: string
          name: string
          price: number
          quantity: number | null
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name: string
          price?: number
          quantity?: number | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          price?: number
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vtu_providers: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          metadata: Json
          name: string
          service_type: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          service_type: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          service_type?: string
        }
        Relationships: []
      }
      vtu_transactions: {
        Row: {
          amount: number
          created_at: string
          estate_id: string | null
          id: string
          meta: Json
          package_label: string | null
          provider_code: string
          provider_name: string
          recipient: string
          reference: string
          service_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          estate_id?: string | null
          id?: string
          meta?: Json
          package_label?: string | null
          provider_code: string
          provider_name: string
          recipient: string
          reference: string
          service_type: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          estate_id?: string | null
          id?: string
          meta?: Json
          package_label?: string | null
          provider_code?: string
          provider_name?: string
          recipient?: string
          reference?: string
          service_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vtu_transactions_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_estate: { Args: { _estate_id: string }; Returns: undefined }
      assign_estate_admin: {
        Args: { _estate_id: string; _user_id: string }
        Returns: undefined
      }
      create_estate_admin_invite: {
        Args: { _email: string; _estate_id: string }
        Returns: string
      }
      create_meeting_and_notify: {
        Args: {
          _description: string
          _join_url: string
          _location: string
          _starts_at: string
          _title: string
        }
        Returns: string
      }
      current_estate_id: { Args: never; Returns: string }
      current_role_is: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      generate_unique_estate_code: { Args: never; Returns: string }
      guard_check_in: {
        Args: { _invite_id: string; _vehicle_number?: string }
        Returns: Json
      }
      guard_check_out: { Args: { _invite_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      lookup_estate_by_code: {
        Args: { _code: string }
        Returns: {
          code: string
          id: string
          name: string
          status: Database["public"]["Enums"]["estate_status"]
        }[]
      }
      reassign_estate_admin: {
        Args: { _estate_id: string; _new_admin_user_id: string }
        Returns: undefined
      }
      redeem_estate_admin_invite: { Args: { _token: string }; Returns: string }
      remove_estate_admin: { Args: { _estate_id: string }; Returns: undefined }
      review_verification: {
        Args: { _approve: boolean; _notes: string; _user_id: string }
        Returns: undefined
      }
      set_estate_access: {
        Args: { _approved: boolean; _user_id: string }
        Returns: undefined
      }
      submit_verification: {
        Args: {
          _block: string
          _doc_path: string
          _full_name: string
          _house_number: string
          _occupant_type: Database["public"]["Enums"]["occupant_type"]
          _phone: string
          _street: string
        }
        Returns: undefined
      }
      super_estate_overview: { Args: { _estate_id: string }; Returns: Json }
      suspend_estate: {
        Args: { _estate_id: string; _reason?: string }
        Returns: undefined
      }
      update_estate: {
        Args: {
          _address: string
          _city: string
          _contact_email: string
          _contact_phone: string
          _estate_id: string
          _name: string
          _state: string
        }
        Returns: undefined
      }
      validate_guest_code: { Args: { _code: string }; Returns: Json }
    }
    Enums: {
      app_role:
        | "resident"
        | "guard"
        | "estate_admin"
        | "super_admin"
        | "event_organizer"
      bill_status: "unpaid" | "paid" | "overdue"
      estate_status: "active" | "suspended"
      invite_status: "active" | "used" | "expired" | "revoked"
      issue_severity: "low" | "medium" | "high" | "critical"
      issue_status: "open" | "in_progress" | "resolved"
      occupant_type: "resident" | "commercial"
      verification_status:
        | "not_submitted"
        | "incomplete"
        | "pending"
        | "approved"
        | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "resident",
        "guard",
        "estate_admin",
        "super_admin",
        "event_organizer",
      ],
      bill_status: ["unpaid", "paid", "overdue"],
      estate_status: ["active", "suspended"],
      invite_status: ["active", "used", "expired", "revoked"],
      issue_severity: ["low", "medium", "high", "critical"],
      issue_status: ["open", "in_progress", "resolved"],
      occupant_type: ["resident", "commercial"],
      verification_status: [
        "not_submitted",
        "incomplete",
        "pending",
        "approved",
        "rejected",
      ],
    },
  },
} as const
