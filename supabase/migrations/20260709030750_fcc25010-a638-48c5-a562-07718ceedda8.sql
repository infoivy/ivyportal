
CREATE OR REPLACE FUNCTION public.student_toggle_action_item(_call_id uuid, _index int, _done boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _items jsonb;
  _owner uuid;
BEGIN
  SELECT sc.action_items_json, s.user_id
    INTO _items, _owner
    FROM public.student_calls sc
    JOIN public.students s ON s.id = sc.student_id
   WHERE sc.id = _call_id;

  IF _owner IS NULL OR _owner <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR _index < 0 OR _index >= jsonb_array_length(_items) THEN
    RAISE EXCEPTION 'Invalid item index';
  END IF;

  _items := jsonb_set(_items, ARRAY[_index::text, 'done'], to_jsonb(_done), true);

  UPDATE public.student_calls
     SET action_items_json = _items
   WHERE id = _call_id;

  RETURN _items;
END;
$$;

GRANT EXECUTE ON FUNCTION public.student_toggle_action_item(uuid, int, boolean) TO authenticated;
