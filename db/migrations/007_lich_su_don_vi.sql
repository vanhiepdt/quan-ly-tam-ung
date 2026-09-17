create trigger ls_don_vi after insert or update or delete on don_vi
  for each row execute function ghi_lich_su();
