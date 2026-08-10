-- Generic audit helper triggers

CREATE OR REPLACE FUNCTION public.tg_audit_community_posts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row record; v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN v_row := NEW; v_action := 'post.created';
  ELSIF TG_OP = 'UPDATE' THEN v_row := NEW; v_action := 'post.edited';
  ELSE v_row := OLD; v_action := 'post.deleted';
  END IF;

  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
  VALUES (v_row.estate_id, auth.uid(), v_action, 'community_posts', v_row.id,
          jsonb_build_object('post_type', v_row.post_type, 'title', v_row.title));

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_community_posts ON public.community_posts;
CREATE TRIGGER trg_audit_community_posts
AFTER INSERT OR UPDATE OR DELETE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_community_posts();

CREATE OR REPLACE FUNCTION public.tg_audit_post_comments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_estate uuid; v_title text;
BEGIN
  SELECT estate_id, title INTO v_estate, v_title
    FROM public.community_posts WHERE id = COALESCE(NEW.post_id, OLD.post_id);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
    VALUES (v_estate, auth.uid(), 'comment.posted', 'post_comments', NEW.id,
            jsonb_build_object('post_id', NEW.post_id, 'post_title', v_title,
                               'excerpt', left(NEW.body, 140)));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
    VALUES (v_estate, auth.uid(), 'comment.edited', 'post_comments', NEW.id,
            jsonb_build_object('post_id', NEW.post_id, 'post_title', v_title));
    RETURN NEW;
  ELSE
    INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
    VALUES (v_estate, auth.uid(), 'comment.deleted', 'post_comments', OLD.id,
            jsonb_build_object('post_id', OLD.post_id, 'post_title', v_title));
    RETURN OLD;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_audit_post_comments ON public.post_comments;
CREATE TRIGGER trg_audit_post_comments
AFTER INSERT OR UPDATE OR DELETE ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_post_comments();

CREATE OR REPLACE FUNCTION public.tg_audit_meetings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row record; v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN v_row := NEW; v_action := 'meeting.created';
  ELSIF TG_OP = 'UPDATE' THEN v_row := NEW; v_action := 'meeting.edited';
  ELSE v_row := OLD; v_action := 'meeting.cancelled';
  END IF;

  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
  VALUES (v_row.estate_id, auth.uid(), v_action, 'meetings', v_row.id,
          jsonb_build_object('title', v_row.title, 'starts_at', v_row.starts_at));

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_meetings ON public.meetings;
CREATE TRIGGER trg_audit_meetings
AFTER INSERT OR UPDATE OR DELETE ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_meetings();

-- Approvals / revocations / verification changes made on profiles directly
CREATE OR REPLACE FUNCTION public.tg_audit_profiles_access()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.approved IS DISTINCT FROM OLD.approved AND auth.uid() IS DISTINCT FROM NEW.id THEN
    INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
    VALUES (NEW.estate_id, auth.uid(),
            CASE WHEN NEW.approved THEN 'access.granted' ELSE 'access.revoked' END,
            'profiles', NEW.id, jsonb_build_object('full_name', NEW.full_name, 'source', 'profile_update'));
  END IF;

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
    VALUES (NEW.estate_id, auth.uid(), 'verification.' || NEW.verification_status::text,
            'profiles', NEW.id, jsonb_build_object('full_name', NEW.full_name));
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_profiles_access ON public.profiles;
CREATE TRIGGER trg_audit_profiles_access
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_profiles_access();