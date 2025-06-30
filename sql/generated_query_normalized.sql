with 
"Q1" ("ID", "DATA") as (select 1, json{} from dual where 1=2), 
"Q2" ("ID", "DATA") as (select "RESID", "DATA" from "ECOMMERCE"."brands"), 
"Q3" ("DATA", "SOURCE") as (
  select json_transform(q."DATA",
    assign '$."brands"' = json [
      select f."DATA"
      from "Q2" f 
      where 
        json_exists(f."DATA", '$?(@."_id" == $x)' passing
          json_query(q."DATA", '$."brand"' error on error disallow array) as "x" type(strict)
        )
    ]
    type(strict)
  ),q."DATA"
  from "Q1" q
),
"Q4" ("DATA") as (
  select jt."DATA"
  from "Q3" q, json_expand_array(q."DATA", '$."brands"[*]' ignore on missing ignore on empty null on null columns("DATA" json path '$')) jt
),
"Q5" ("DATA") as (
  select json_transform(
    "DATA",
    set '$tmpP0' = PATH '$."brands"."name"' ignore on empty,
    set '$tmpP1' = PATH '$."brands"."_id"' ignore on empty,
    set '$tmpP2' = PATH '$."brands"."isActive"' ignore on empty,
    assign '$."brand"."name"' = PATH '$tmpP0' ignore on empty,
    assign '$."brand"."_id"' = PATH '$tmpP1' ignore on empty,
    assign '$."brand"."isActive"' = PATH '$tmpP2' ignore on empty
    type(strict)
  )
  from "Q4" q
),
"Q6" ("DATA") as (
  select "DATA"
  from "Q5" q
  where JSON_EXISTS("DATA",'$?(@.brand.isActive.booleanOnly() == true)' type(strict))
),
"INPUT" ("DATA") as (
  select "DATA"
  from "Q6" q
),
"Q8" ("DATA") as (select json_mergepatch(i.data, json_object('reviews': json_array(r.data returning json) returning json)) from "Q6" i left outer join reviews r on i.data."_id".idOnly() = r.data.product.idOnly()
),
"Q9" ("DATA") as (
  select json_transform(
    "DATA",
    set '$tmp' = PATH '$."reviews"."rating"[*].sum()',  case when '$tmp == null' then (set '$tmp' = 0) end,
    set '$tmpP0' = PATH '$tmp' ignore on empty,
    set '$tmp' = PATH '$."reviews"',
    check '$tmp.type() == "array"' else 'Input to $size is not an array.',
    set '$tmp' = PATH '$tmp.size()',
    set '$tmpP1' = PATH '$tmp' ignore on empty,
    assign '$."totalRatings"' = PATH '$tmpP0' ignore on empty,
    assign '$."totalReviews"' = PATH '$tmpP1' ignore on empty
    type(strict)
  )
  from "Q8" q
),
"Q10" ("DATA") as (
  select json_transform(
    "DATA",
    case when '@?($."totalReviews" == $b1)'
    then (set '$tmp' = PATH '$b2')
    else (set '$tmp' = PATH '$."totalRatings" / $."totalReviews"') end,
    set '$tmpP0' = PATH '$tmp' ignore on empty,
    assign '$."averageRating"' = PATH '$tmpP0' ignore on empty
    passing treat(? as json(scalar number)) as "b1",
      treat(? as json(scalar number)) as "b2"
    type(strict)
  )
  from "Q9" q
),
"Q11" ("DATA") as (
  select "DATA"
  from "Q10" q
  where JSON_EXISTS("DATA",'$?( (@.isActive.booleanOnly() == true) && ( exists(@.price?( (@.numberOnly() >= $B0) && (@.numberOnly() <= $B1) )) ) && (@.averageRating.numberOnly() >= $B2) )' passing ? as "B0", ? as "B1", ? as "B2" type(strict))
),
"Q12" ("DATA") as (
  select json_transform(
    "DATA",
    remove '$."brands"',
    remove '$."reviews"'
    type(strict)
  )
  from "Q11" q
)
select "DATA" from "Q12"